"""Scheduled baseline data refresh - issue #8.

Runs `agmarknet_service.fetch_prices` for every tracked commodity on an interval,
resolves state/mandi foreign keys (creating mandis on first sight, matching on
existing ones via case-insensitive name + alias), and upserts into `prices` on
(commodity_id, mandi_id, date) - the same triple `prices.uq_price_day` enforces, so a
re-run never creates duplicate rows, it just updates the price fields for that day.

Wiring into the app (backend/main.py):

    from services.refresh_job import start_scheduler, stop_scheduler

    @app.on_event("startup")
    def _startup():
        start_scheduler()

    @app.on_event("shutdown")
    def _shutdown():
        stop_scheduler()

Env vars (add to infra/.env.example alongside this commit per DATA-SOURCES.md Rule #6):
    REFRESH_INTERVAL_HOURS   default 8, clamped to [6, 12] per the documented cadence
    REFRESH_ON_STARTUP       default "true" - run once immediately so docker-compose
                             doesn't leave the app empty for up to REFRESH_INTERVAL_HOURS
"""

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.session import SessionLocal
from models import Commodity, Mandi, Price, State
from services import agmarknet_service, search_cache
from services.agmarknet_service import AgmarknetError

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _interval_hours() -> int:
    raw = os.getenv("REFRESH_INTERVAL_HOURS", "8").strip()
    try:
        hours = int(raw)
    except ValueError:
        log.warning("REFRESH_INTERVAL_HOURS=%r is not an int, defaulting to 8", raw)
        return 8
    # keep it inside the cadence documented in DATA-SOURCES.md rather than fail loudly -
    # a bad env value should degrade to a sane default, not break the refresh entirely
    if not 6 <= hours <= 12:
        clamped = min(max(hours, 6), 12)
        log.warning("REFRESH_INTERVAL_HOURS=%d outside [6,12], clamping to %d", hours, clamped)
        return clamped
    return hours


@dataclass
class CommodityRunResult:
    commodity: str
    fetched: int = 0
    upserted: int = 0
    skipped_unresolved: int = 0
    error: str | None = None


@dataclass
class RefreshRunSummary:
    started_at: datetime
    finished_at: datetime | None = None
    results: list[CommodityRunResult] = field(default_factory=list)

    @property
    def succeeded(self) -> list[CommodityRunResult]:
        return [r for r in self.results if r.error is None]

    @property
    def failed(self) -> list[CommodityRunResult]:
        return [r for r in self.results if r.error is not None]


def _tracked_commodities(session: Session) -> list[str]:
    """Commodities to refresh = whatever is seeded in the `commodities` table.

    Single source of truth: adding a row to `commodities` (db/seed.py, issue #6) is
    enough to bring a new commodity into the refresh cycle - nothing here needs editing.
    """
    names = session.scalars(select(Commodity.name)).all()
    return [n.lower() for n in names]


def _resolve_state(session: Session, raw_name: str) -> State | None:
    """Case-insensitive match against `states` (pre-seeded, issue #6).

    Agmarknet sends inconsistent casing ("Punjab" / "PUNJAB") - see DATA-SOURCES.md.
    We never create a state here; if Agmarknet reports a name that doesn't match any
    seeded state, that row is unresolvable and gets skipped + counted, not guessed at.
    """
    if not raw_name:
        return None
    return session.scalars(
        select(State).where(State.name.ilike(raw_name.strip()))
    ).first()


def _resolve_mandi(session: Session, state: State, name: str, raw_name: str) -> Mandi:
    """Match an existing mandi by canonical name or alias within the state; create if new.

    `name` is already the cleaned form from `agmarknet_service._mandi_name`. `raw_name`
    is what Agmarknet actually sent ("Khanna(Grain Market)") and is what gets appended
    to `aliases` so a future ingest with a slightly different raw string still matches.
    """
    existing = session.scalars(
        select(Mandi).where(Mandi.state_id == state.id, Mandi.name.ilike(name))
    ).first()

    if existing is None:
        # alias fallback: same market, different canonical spelling seen historically
        existing = session.scalars(
            select(Mandi).where(
                Mandi.state_id == state.id, Mandi.aliases.any(raw_name)
            )
        ).first()

    if existing is None:
        mandi = Mandi(state_id=state.id, name=name, aliases=[raw_name])
        session.add(mandi)
        session.flush()  # need mandi.id for the price upsert below
        return mandi

    if raw_name and raw_name not in (existing.aliases or []):
        existing.aliases = [*(existing.aliases or []), raw_name]

    return existing


def _upsert_prices(session: Session, commodity: Commodity, rows: list[dict]) -> tuple[int, int]:
    """Resolve FKs and upsert each row. Returns (upserted, skipped_unresolved)."""
    upserted = skipped = 0

    for row in rows:
        state = _resolve_state(session, row["state"])
        if state is None:
            skipped += 1
            log.warning(
                "agmarknet %s: unresolved state %r (mandi=%s) - row skipped, not guessed",
                commodity.name, row["state"], row["mandi"],
            )
            continue

        mandi = _resolve_mandi(session, state, row["mandi"], row["mandi_raw"])

        stmt = pg_insert(Price).values(
            commodity_id=commodity.id,
            mandi_id=mandi.id,
            min_price=row["min_price"],
            max_price=row["max_price"],
            modal_price=row["modal_price"],
            arrival_qty=row["arrival_qty"],  # always None from this source - see agmarknet_service
            date=row["date"],
        ).on_conflict_do_update(
            constraint="uq_price_day",  # (commodity_id, mandi_id, date) per architecture.md
            set_={
                "min_price": row["min_price"],
                "max_price": row["max_price"],
                "modal_price": row["modal_price"],
                # deliberately NOT overwriting arrival_qty with None on every re-run:
                # if a future source ever populates it, a same-day re-run from this
                # gov-API-only source must not clobber that value back to null
            },
        )
        session.execute(stmt)
        upserted += 1

    return upserted, skipped


def refresh_commodity(session: Session, commodity_name: str) -> CommodityRunResult:
    result = CommodityRunResult(commodity=commodity_name)

    commodity = session.scalars(
        select(Commodity).where(Commodity.name.ilike(commodity_name))
    ).first()
    if commodity is None:
        result.error = f"'{commodity_name}' is in the tracked list but missing from commodities table"
        log.error(result.error)
        return result

    try:
        rows = agmarknet_service.fetch_prices(commodity_name)
    except AgmarknetError as exc:
        # known, named failure mode (network/WAF/rate-limit) - log clearly, move on to
        # the next commodity rather than letting one bad fetch kill the whole run
        result.error = f"AgmarknetError: {exc}"
        log.error("agmarknet %s: fetch failed: %s", commodity_name, exc)
        return result
    except Exception as exc:  # noqa: BLE001 - intentionally broad: this must never be silent
        result.error = f"unexpected {type(exc).__name__}: {exc}"
        log.exception("agmarknet %s: unexpected failure during fetch", commodity_name)
        return result

    result.fetched = len(rows)
    if not rows:
        log.info("agmarknet %s: 0 rows returned this cycle", commodity_name)
        return result

    try:
        upserted, skipped = _upsert_prices(session, commodity, rows)
        session.commit()
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        result.error = f"upsert failed: {type(exc).__name__}: {exc}"
        log.exception("agmarknet %s: upsert failed, transaction rolled back", commodity_name)
        return result

    result.upserted = upserted
    result.skipped_unresolved = skipped
    log.info(
        "agmarknet %s: fetched=%d upserted=%d skipped_unresolved=%d",
        commodity_name, result.fetched, result.upserted, result.skipped_unresolved,
    )
    return result


def run_refresh() -> RefreshRunSummary:
    """Entry point the scheduler calls. One DB session per run, one commodity at a
    time, sequentially - Agmarknet's demo-key rate limit (see agmarknet_service.py)
    makes concurrent fetches counterproductive anyway.
    """
    summary = RefreshRunSummary(started_at=datetime.now(timezone.utc))
    session = SessionLocal()
    try:
        commodities = _tracked_commodities(session)
        if not commodities:
            log.warning("refresh run started with zero tracked commodities - check db/seed.py ran")
        for name in commodities:
            summary.results.append(refresh_commodity(session, name))
    finally:
        session.close()
        summary.finished_at = datetime.now(timezone.utc)

    ok, failed = summary.succeeded, summary.failed
    log.info(
        "refresh run complete: %d/%d commodities ok, %d row(s) upserted total, %.1fs elapsed",
        len(ok), len(summary.results),
        sum(r.upserted for r in ok),
        (summary.finished_at - summary.started_at).total_seconds(),
    )
    if failed:
        # this is the "not silently swallowed" requirement: a failed commodity is
        # already logged individually in refresh_commodity, and shows up again here
        # as a named summary line so it's visible even if you only read the tail
        log.error(
            "refresh run had %d failure(s): %s",
            len(failed), ", ".join(f"{r.commodity} ({r.error})" for r in failed),
        )
    # any successful upsert above changed rankings, so cached /api/search responses
    # are stale the moment this run lands - invalidate even if some commodities failed
    search_cache.invalidate_all()
    return summary


def start_scheduler() -> BackgroundScheduler:
    """Call once from the FastAPI startup event. Idempotent."""
    global _scheduler
    if _scheduler is not None:
        log.warning("start_scheduler called twice - ignoring, scheduler already running")
        return _scheduler

    hours = _interval_hours()
    _scheduler = BackgroundScheduler(
        executors={"default": ThreadPoolExecutor(max_workers=1)},
        job_defaults={
            "coalesce": True,      # if the app was down across multiple intervals, run once, not N times
            "max_instances": 1,    # never let two refresh runs overlap
            "misfire_grace_time": 3600,
        },
        timezone="UTC",
    )
    _scheduler.add_job(
        run_refresh,
        trigger="interval",
        hours=hours,
        id="agmarknet_baseline_refresh",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("baseline refresh scheduler started: every %dh", hours)

    if os.getenv("REFRESH_ON_STARTUP", "true").strip().lower() in ("1", "true", "yes"):
        # run once immediately in the background so a fresh docker-compose environment
        # has data right away instead of waiting up to `hours` for the first tick
        _scheduler.add_job(run_refresh, id="agmarknet_baseline_refresh_initial")

    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("baseline refresh scheduler stopped")


if __name__ == "__main__":
    # manual one-off run for local testing: `python -m services.refresh_job`
    logging.basicConfig(level=logging.INFO)
    run_refresh()
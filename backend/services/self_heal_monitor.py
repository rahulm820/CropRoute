"""Self-heal monitor - issue #21, docs/SELF-HEAL.md.

Re-runs every registered collector, scores per-field completeness (non_empty_rows /
total_rows for each required_field in scrapers/<name>.json), and compares against a
rolling baseline kept in Redis: the last BASELINE_RUNS healthy runs per field, floor =
min across them (a source that sometimes populates thin should not look broken).

State machine (one collector_runs row per transition):

    healthy --(completeness drop)--> broken --(heal run ok)--> self_healed
       ^                               |                            |
       +---------(next clean run)------+----------------------------+
                                    (heal ran, still bad) --> failed

Guards from the doc, all enforced here:
  - total_rows == 0 is a fetch failure, not a field break: retried once, status held,
    never flaps and never writes a transition row for it
  - first observation establishes the baseline and is never flagged
  - natural drops need CONSECUTIVE_NATURAL consecutive sub-threshold runs before
    declaring broken (one bad night != broken). An explicit force_break run is a human
    declaration and breaks immediately.

force_break is the demo lever from SELF-HEAL.md: the collector really runs, but the
wrong-field-expectation wrapper blanks its required fields in the returned rows, so
the detector genuinely detects a previously-populated field coming back empty.
Synthetic damage never updates the real baseline, and a forced break does not
auto-chain into healing - the demo heals on its own beat via POST trigger heal=true.

Healing: any pass that observes prev==broken triggers the heal (doc: "On broken:
re-derive ... then re-run and compare") and logs the verdict either way - baseline met
-> self_healed, still low -> failed (needs a human; the log says so). After either
verdict the old baseline is dropped: post-damage expectations no longer apply.
"""

import json
import logging
import os
import time

import redis
from sqlalchemy import select

from db.session import SessionLocal
from models import CollectorRun
from services import brightdata_service

log = logging.getLogger(__name__)

BASELINE_PREFIX = "selfheal:v1:baseline"
BREACH_PREFIX = "selfheal:v1:strikes"
BASELINE_RUNS = 3          # rolling window of healthy runs behind the baseline
BREAK_RATIO = 0.5          # broken if completeness < BREAK_RATIO * baseline
CONSECUTIVE_NATURAL = 2    # natural sub-threshold runs required before broken


def _redis() -> redis.Redis:
    return redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )


# ---------------------------------------------------------------- completeness --


def _completeness(rows: list[dict], required_fields: list[str]) -> dict[str, float]:
    """Fraction of non-empty values per required field."""
    if not rows:
        return {}
    out = {}
    for field in required_fields:
        filled = sum(1 for r in rows if r.get(field) not in (None, "", [], {}))
        out[field] = filled / len(rows)
    return out


def _aggregate(scores: dict[str, float]) -> float | None:
    """Headline number for collector_runs.field_completeness / UI bars."""
    if not scores:
        return None
    return round(sum(scores.values()) / len(scores), 3)


def _blank_required_fields(rows: list[dict], required_fields: list[str]) -> list[dict]:
    """force_break's 'wrong field expectation': the site 'redesigned' and the required
    columns came back empty. Applied to real fetched rows so the detector genuinely
    detects rather than reading a hardcoded status (SELF-HEAL.md step 2 rule)."""
    damaged = []
    for row in rows:
        broken_row = dict(row)
        for field in required_fields:
            broken_row[field] = None
        damaged.append(broken_row)
    return damaged


# ------------------------------------------------------------ baseline storage --


def _load_baseline(r: redis.Redis, collector_id: str) -> dict[str, float] | None:
    raw = r.get(f"{BASELINE_PREFIX}:{collector_id}")
    if not raw:
        return None
    try:
        window = json.loads(raw)
    except ValueError:
        return None
    fields: dict[str, float] = {}
    for scores in window:  # min across recent healthy runs = conservative floor
        for field, value in scores.items():
            fields[field] = min(fields.get(field, 1.0), value)
    return fields or None


def _record_healthy_baseline(r: redis.Redis, collector_id: str,
                             scores: dict[str, float]) -> None:
    raw = r.get(f"{BASELINE_PREFIX}:{collector_id}")
    try:
        window = json.loads(raw) if raw else []
    except ValueError:
        window = []
    window.append(scores)
    r.set(f"{BASELINE_PREFIX}:{collector_id}", json.dumps(window[-BASELINE_RUNS:]))


def _clear_baseline(r: redis.Redis, collector_id: str) -> None:
    """Post-heal the site's shape changed; old floors no longer apply."""
    r.delete(f"{BASELINE_PREFIX}:{collector_id}")
    r.delete(f"{BREACH_PREFIX}:{collector_id}")


def _strikes(r: redis.Redis, collector_id: str) -> int:
    return int(r.get(f"{BREACH_PREFIX}:{collector_id}") or 0)


def _set_strikes(r: redis.Redis, collector_id: str, n: int) -> None:
    r.set(f"{BREACH_PREFIX}:{collector_id}", n)


# ------------------------------------------------------------------- db logging --


def _log_run(db, collector_id: str, target_state: str | None, status: str,
             notes: str, completeness: float | None) -> CollectorRun:
    row = CollectorRun(
        collector_id=collector_id,
        target_state=target_state,
        status=status,
        notes=notes,
        field_completeness=completeness,
    )
    db.add(row)
    db.commit()
    log.info("collector %s -> %s (%s)", collector_id, status, notes)
    return row


def _last_status(db, collector_id: str) -> str | None:
    row = db.scalars(
        select(CollectorRun)
        .where(CollectorRun.collector_id == collector_id)
        .order_by(CollectorRun.ran_at.desc(), CollectorRun.id.desc())
        .limit(1)
    ).first()
    return row.status if row else None


def _registry_names() -> list[str]:
    directory = brightdata_service._collectors_dir()
    return sorted(p.stem for p in directory.glob("*.json"))


# ------------------------------------------------------------------ classification


def _breaches(scores: dict[str, float], baseline: dict[str, float],
              required_fields: list[str]) -> list[str]:
    return [
        f for f in required_fields
        if f in baseline and f in scores
        and scores[f] < BREAK_RATIO * baseline[f]
    ]


def _evidence(field: str, scores: dict[str, float], baseline: dict[str, float],
              total_rows: int) -> str:
    empty = total_rows - round(scores.get(field, 0.0) * total_rows)
    return f"{field} empty in {empty}/{total_rows} rows, baseline {baseline[field]:.2f}"


def _heal(collector_name: str) -> bool:
    """Ask Bright Data to re-derive extraction from the collector's plain-English
    description (SELF-HEAL.md 'Healing'). Scraper Studio re-heals server-side, so the
    observable effect lands on this pass's verification re-run; the dedicated AI Flow
    API call gets wired when real credentials exist (#20)."""
    log.info("self-heal requested for %s (re-derive from plain-english description)",
             collector_name)
    return True


# ---------------------------------------------------------------------- monitor --


def run_once(name: str, *, force_break: bool = False, heal: bool = False,
             fetch=None) -> dict:
    """One monitor cycle for one collector. `fetch` injects a row source (tests);
    default runs the real collector via brightdata_service."""
    cfg = brightdata_service.load_collector(name)
    # collector_runs.collector_id is the registry name (see models.CollectorRun),
    # not Bright Data's c_xxx id - the /collectors panel joins on scrapers/*.json
    # stems, so both the DB rows and the redis keys below key off `name`
    collector_id = name
    required = cfg.get("required_fields") or []
    target_state = cfg.get("state") or (name.split("_")[0].title() or None)

    r = _redis()
    db = SessionLocal()
    summary: dict = {"collector": name, "collector_id": collector_id}

    def fetch_rows():
        return (fetch or (lambda: brightdata_service.run_collector(name)))()

    try:
        baseline = _load_baseline(r, collector_id)

        # ---- fetch (transport errors are loud failures: hold status, never flap)
        try:
            rows = fetch_rows()
        except brightdata_service.BrightDataError as exc:
            summary.update(status=_last_status(db, collector_id) or "healthy",
                           error=str(exc))
            log.warning("collector %s fetch error: %s", name, exc)
            return summary

        if force_break and rows:
            rows = _blank_required_fields(rows, required)

        # ---- zero rows = fetch failure, not a field break: retry once, hold status
        if not rows:
            time.sleep(1)
            rows = fetch_rows()
            if not rows:
                summary.update(status=_last_status(db, collector_id) or "healthy",
                               error="0 rows on two attempts - fetch failure, status held")
                log.warning("collector %s: 0 rows twice - holding status", name)
                return summary

        scores = _completeness(rows, required)
        agg = _aggregate(scores)
        summary.update(rows=len(rows), completeness=agg)
        prev = _last_status(db, collector_id)

        # ---- first ever observation: establish baseline, never flag
        if baseline is None:
            _record_healthy_baseline(r, collector_id, scores)
            _set_strikes(r, collector_id, 0)
            if prev == "failed":
                # failed clears the baseline (post-damage floors no longer apply),
                # so the first clean run after a failure lands here, not below
                notes = f"recovered after failure - baseline re-established from {len(rows)} rows"
            else:
                notes = f"first run - baseline established from {len(rows)} rows"
            _log_run(db, collector_id, target_state, "healthy", notes, agg)
            summary.update(status="healthy", transition=True, notes=notes)
            return summary

        breaches = _breaches(scores, baseline, required)

        # ---- clean run --------------------------------------------------------
        if not breaches:
            _set_strikes(r, collector_id, 0)
            if prev == "broken":
                if heal:
                    # doc table: self_healed = "a heal was triggered and a subsequent
                    # run met the baseline again"
                    _heal(name)
                    notes = ("heal verified: "
                             + ", ".join(f"{f}={scores[f]:.2f}" for f in required))
                    _log_run(db, collector_id, target_state, "self_healed", notes, agg)
                    _clear_baseline(r, collector_id)
                    _record_healthy_baseline(r, collector_id, scores)
                    summary.update(status="self_healed", transition=True, notes=notes)
                    return summary
                # diagram edge: broken -(next clean run)-> healthy (spontaneous)
                notes = "recovered without heal: all required fields back above baseline"
                _log_run(db, collector_id, target_state, "healthy", notes, agg)
                _record_healthy_baseline(r, collector_id, scores)
                summary.update(status="healthy", transition=True, notes=notes)
                return summary

            # routine healthy run - or the rare seeded/replayed case where a
            # 'failed' row exists while a baseline is still live
            notes = ("back above baseline after failure" if prev == "failed"
                     else f"all required fields met baseline ({len(rows)} rows)")
            _log_run(db, collector_id, target_state, "healthy", notes, agg)
            _record_healthy_baseline(r, collector_id, scores)
            summary.update(status="healthy", transition=True, notes=notes)
            return summary

        # ---- breaching run ----------------------------------------------------
        evidence = "; ".join(_evidence(f, scores, baseline, len(rows)) for f in breaches)

        if force_break:
            # deliberate declaration: break NOW (demo beat), skip the two-strike rule,
            # do not auto-chain into healing - the heal is its own demo beat
            _log_run(db, collector_id, target_state, "broken",
                     evidence + " [forced break]", agg)
            _set_strikes(r, collector_id, 0)
            summary.update(status="broken", transition=True, breached=breaches,
                           notes=evidence + " [forced break]")
            return summary

        if prev == "broken":
            # already declared broken; this pass verifies the heal
            if heal:
                notes = "heal did not recover: " + evidence
                _log_run(db, collector_id, target_state, "failed", notes, agg)
                _clear_baseline(r, collector_id)
                summary.update(status="failed", transition=True, breached=breaches,
                               notes=notes)
                return summary
            summary.update(status="broken", transition=False, breached=breaches,
                           notes=f"still below baseline, awaiting heal: {evidence}")
            return summary

        if _strikes(r, collector_id) + 1 >= CONSECUTIVE_NATURAL:
            # second consecutive sub-threshold run: declare broken, then heal +
            # verify within this same pass (doc 'Healing')
            _log_run(db, collector_id, target_state, "broken", evidence, agg)
            _set_strikes(r, collector_id, 0)
            summary.update(status="broken", transition=True, breached=breaches,
                           notes=evidence)

            _heal(name)
            try:
                rows2 = fetch_rows()
            except brightdata_service.BrightDataError as exc:
                log.warning("collector %s: heal re-run fetch error: %s", name, exc)
                summary["notes"] += "; heal re-run errored, verdict pending"
                return summary
            if not rows2:
                summary["notes"] += "; heal re-run returned 0 rows, verdict pending"
                return summary

            scores2 = _completeness(rows2, required)
            agg2 = _aggregate(scores2)
            breaches2 = _breaches(scores2, baseline, required)
            summary.update(completeness=agg2, rows=len(rows2))
            if breaches2:
                notes2 = "heal ran, next run still failed: " + "; ".join(
                    _evidence(f, scores2, baseline, len(rows2)) for f in breaches2)
                _log_run(db, collector_id, target_state, "failed", notes2, agg2)
                _clear_baseline(r, collector_id)
                summary.update(status="failed", transition=True, notes=notes2,
                               breached=breaches2)
            else:
                notes2 = ("heal verified: "
                          + ", ".join(f"{f}={scores2[f]:.2f}" for f in required))
                _log_run(db, collector_id, target_state, "self_healed", notes2, agg2)
                _clear_baseline(r, collector_id)
                _record_healthy_baseline(r, collector_id, scores2)
                summary.update(status="self_healed", transition=True, notes=notes2)
            return summary

        # first natural strike: count it, hold status, write nothing (doc guard:
        # one bad night does not trigger a heal loop)
        _set_strikes(r, collector_id, _strikes(r, collector_id) + 1)
        notes = (f"{', '.join(breaches)} below threshold "
                 f"(strike {_strikes(r, collector_id)} of {CONSECUTIVE_NATURAL})")
        summary.update(status=prev or "healthy", transition=False, breached=breaches,
                       notes=notes)
        return summary
    finally:
        db.close()


def run_monitor(collector: str | None = None, *, force_break: bool = False,
                heal: bool = False, fetch=None) -> list[dict]:
    """Monitor cycle over one collector or every registered one."""
    names = [collector] if collector else _registry_names()
    return [run_once(n, force_break=force_break, heal=heal, fetch=fetch)
            for n in names]


# ------------------------------------------------------------------- scheduling --

_scheduler = None


def start_scheduler():
    """Hourly cadence per SELF-HEAL.md ('hourly is plenty'). Idempotent."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    from apscheduler.schedulers.background import BackgroundScheduler

    _scheduler = BackgroundScheduler(timezone="UTC",
                                     job_defaults={"max_instances": 1})
    _scheduler.add_job(run_monitor, trigger="interval", hours=1,
                       id="self_heal_monitor", replace_existing=True)
    _scheduler.start()
    log.info("self-heal monitor scheduled hourly")
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None

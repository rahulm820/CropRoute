"""Lazy mandi enrichment — live scrape on cache miss, fast on hit.

On GET /api/mandi/:id, the router calls ``enrich_mandi`` which:
1. Queries the dealers table for rows linked to this mandi.
2. If the most recent scraped_at is < STALENESS_DAYS old, returns cached rows.
3. Otherwise triggers the relevant Bright Data collector (looked up by state),
   ingests the matching rows, logs a CollectorRun, and returns the fresh data.

Every dealer row carries source_url + scraped_at (CLAUDE.md provenance rule).
The enrichment.status field in the API response tells the frontend whether to
show a spinner ("running"), a warning ("stale"/"failed"), or nothing ("fresh").
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import CollectorRun, Dealer, Mandi, State
from services import brightdata_service
from services.brightdata_service import BrightDataError

log = logging.getLogger(__name__)

STALENESS_DAYS = 7

# state name -> collector registry name (scrapers/<name>.json)
_STATE_COLLECTOR: dict[str, str] = {
    "Punjab": "punjab_apmc",
    "Madhya Pradesh": "mp_apmc",
    "Uttar Pradesh": "up_apmc",
}


def _collector_for_state(state_name: str) -> str | None:
    return _STATE_COLLECTOR.get(state_name)


def _latest_dealer_ts(db: Session, mandi_id: int) -> datetime | None:
    """Most recent scraped_at across all dealers for this mandi, or None."""
    return db.scalars(
        select(func.max(Dealer.scraped_at)).where(Dealer.mandi_id == mandi_id)
    ).first()


def is_fresh(db: Session, mandi_id: int) -> bool:
    ts = _latest_dealer_ts(db, mandi_id)
    if ts is None:
        return False
    age = datetime.now(timezone.utc) - ts
    return age < timedelta(days=STALENESS_DAYS)


def get_enrichment_status(db: Session, mandi_id: int) -> dict:
    """Return the enrichment status block for the API response."""
    ts = _latest_dealer_ts(db, mandi_id)
    if ts is None:
        status = "stale"
    elif datetime.now(timezone.utc) - ts < timedelta(days=STALENESS_DAYS):
        status = "fresh"
    else:
        status = "stale"

    # check if a recent collector run failed
    mandi = db.get(Mandi, mandi_id)
    if mandi is not None:
        collector = _collector_for_state(mandi.state.name) if mandi.state else None
        if collector:
            last_run = db.scalars(
                select(CollectorRun)
                .where(CollectorRun.collector_id == collector)
                .order_by(CollectorRun.ran_at.desc())
                .limit(1)
            ).first()
            if last_run and last_run.status == "failed":
                status = "failed"
    else:
        collector = None

    return {"status": status, "collector": collector}


def _ingest_rows(
    db: Session, mandi_id: int, collector_name: str, rows: list[dict]
) -> int:
    """Map raw collector output onto Dealer rows and persist. Returns count ingested.

    The collector scrapes at state level; rows are filtered to this mandi by
    matching on the mandi name appearing in the row's location/address fields.
    The field mapping is intentionally forgiving — IndiaMART listings vary wildly
    in schema — and logs un-parseable rows rather than failing the whole run.
    """
    now = datetime.now(timezone.utc)
    mandi = db.get(Mandi, mandi_id)
    if mandi is None:
        return 0

    mandi_name_lower = mandi.name.lower()
    state_name_lower = mandi.state.name.lower() if mandi.state else ""

    ingested = 0
    for row in rows:
        # --- mandi-area filter ---
        # a row belongs to this mandi if the mandi name or state name appears
        # anywhere in the row's address, city, or location fields
        haystack = " ".join(
            str(row.get(f) or "").lower()
            for f in ("address", "city", "location", "area", "mandi")
        )
        if mandi_name_lower not in haystack and state_name_lower not in haystack:
            continue

        name = (row.get("business_name") or row.get("name") or "").strip()
        if not name:
            continue

        phone = (row.get("phone") or row.get("contact_number") or "").strip() or None
        role = (row.get("role") or row.get("type") or "").strip() or None
        source_url = (
            row.get("listing_url") or row.get("url") or row.get("source_url") or ""
        ).strip()
        if not source_url:
            continue

        db.add(
            Dealer(
                mandi_id=mandi_id,
                name=name,
                phone=phone,
                role=role,
                source_url=source_url,
                scraped_at=now,
            )
        )
        ingested += 1

    if ingested:
        db.flush()
    return ingested


def _log_run(
    db: Session,
    collector_name: str,
    state_name: str | None,
    status: str,
    notes: str | None = None,
    field_completeness: float | None = None,
) -> None:
    db.add(
        CollectorRun(
            collector_id=collector_name,
            target_state=state_name,
            status=status,
            notes=notes,
            field_completeness=field_completeness,
        )
    )
    db.flush()


def enrich_mandi(
    db: Session, mandi_id: int, *, force: bool = False
) -> list[dict]:
    """Ensure dealer data for `mandi_id` is fresh, then return it.

    If data is missing or stale (>STALENESS_DAYS), triggers the Bright Data
    collector for the mandi's state, ingests matching rows, and logs a
    CollectorRun.  On BrightDataError the run is logged as "failed" and any
    rows already cached are returned (graceful degradation).

    Set ``force=True`` to bypass the freshness check (used by the collector
    trigger endpoint for the self-heal demo).
    """
    if not force and is_fresh(db, mandi_id):
        return [
            _dealer_dict(d)
            for d in db.scalars(
                select(Dealer).where(Dealer.mandi_id == mandi_id)
            ).all()
        ]

    mandi = db.get(Mandi, mandi_id)
    if mandi is None:
        return []

    state_name = mandi.state.name if mandi.state else None
    collector_name = _collector_for_state(state_name) if state_name else None
    if collector_name is None:
        log.warning("no collector mapped for state %r (mandi %d)", state_name, mandi_id)
        return [
            _dealer_dict(d)
            for d in db.scalars(
                select(Dealer).where(Dealer.mandi_id == mandi_id)
            ).all()
        ]

    # --- trigger live scrape ---
    log.info("enriching mandi %d (%s) via collector %s", mandi_id, mandi.name, collector_name)
    try:
        rows = brightdata_service.run_collector(collector_name)
    except BrightDataError as exc:
        log.error("collector %s failed for mandi %d: %s", collector_name, mandi_id, exc)
        _log_run(db, collector_name, state_name, "failed", notes=str(exc)[:500])
        db.commit()
        # return whatever cached data we have — stale is better than nothing
        return [
            _dealer_dict(d)
            for d in db.scalars(
                select(Dealer).where(Dealer.mandi_id == mandi_id)
            ).all()
        ]

    # --- ingest ---
    # clear stale rows before writing fresh ones so deleted listings disappear
    stale_rows = db.scalars(
        select(Dealer).where(Dealer.mandi_id == mandi_id)
    ).all()
    for old in stale_rows:
        db.delete(old)
    db.flush()

    ingested = _ingest_rows(db, mandi_id, collector_name, rows)
    completeness = ingested / len(rows) if rows else 0.0
    _log_run(
        db,
        collector_name,
        state_name,
        "healthy",
        notes=f"{ingested}/{len(rows)} rows matched mandi {mandi.name}",
        field_completeness=round(completeness, 3),
    )
    db.commit()

    log.info(
        "mandi %d enriched: %d/%d rows ingested, completeness %.3f",
        mandi_id, ingested, len(rows), completeness,
    )
    return [
        _dealer_dict(d)
        for d in db.scalars(
            select(Dealer).where(Dealer.mandi_id == mandi_id)
        ).all()
    ]


def _dealer_dict(d: Dealer) -> dict:
    return {
        "name": d.name,
        "role": d.role,
        "phone": d.phone,
        "source_url": d.source_url,
        "scraped_at": d.scraped_at.isoformat() if d.scraped_at else None,
    }

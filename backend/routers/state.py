"""GET /api/state/:id region bundle - issue #30 (docs/API.md "Region").

One response for the /state/[id] page: state header, top mandis, weather, news,
fertilizer prices, crop knowledge. Each wrapped section carries its own
`status: ok | stale | empty | failed` so the UI can render per-section states
(UI-DESIGN.md "States") instead of blanking the page when one source dies.

Sections resolve concurrently in a thread pool. Every resolver opens its own DB
session (a Session is not thread-safe) and every failure is caught INSIDE its own
section - the AC is literally "killing the news source still returns 200 with
news.status='failed' and every other section ok".

Stale means "older than that source's refresh cadence" (UI-DESIGN.md rule 3):
stale data is still returned and rendered with a warn chip - old-but-labelled beats
absent. Windows follow docs/DATA-SOURCES.md cadences.
"""

import concurrent.futures
import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db.session import SessionLocal, get_db
from models import (
    Commodity,
    CropKnowledge,
    FertilizerPrice,
    Mandi,
    News,
    Price,
    State,
)
from services import weather_service

router = APIRouter()

log = logging.getLogger(__name__)

SECTION_TIMEOUT_S = 6.0  # cold Open-Meteo fetch can take seconds; warm path is ms
NEWS_FRESH_DAYS = 2      # news scrapes daily; anything older renders 'stale'
FERTILIZER_FRESH_DAYS = 8  # weekly retail check + a grace day


def _wrap(status: str, data=None, error: str | None = None) -> dict:
    out = {"status": status, "data": [] if data is None else data}
    if error:
        out["error"] = error
    return out


def _safe(section: str, fn, *args) -> dict:
    """Run one resolver so nothing it does can escape into the bundle response."""
    try:
        return fn(*args)
    except Exception as exc:  # noqa: BLE001 - exactly the point of this wrapper
        log.warning("region section %r failed: %s", section, exc)
        return _wrap("failed", error=f"{type(exc).__name__}: {exc}"[:200])


# ------------------------------------------------------------------- sections --


def _top_mandis(state_id: int) -> list[dict]:
    """Top 5 mandis in the state for its most recently reported commodity.

    PAGES.md: modal price + 7-day sparkline per mandi. Ranking mirrors /api/search's
    product logic (arrivals desc, nulls last, price asc tiebreak). trend_7d is the
    last <=7 daily modal prices oldest-first for the sparkline.
    """
    db = SessionLocal()
    try:
        freshest = db.execute(
            select(Price.commodity_id, func.max(Price.date).label("d"),
                   func.count().label("n"))
            .join(Mandi, Price.mandi_id == Mandi.id)
            .where(Mandi.state_id == state_id)
            .group_by(Price.commodity_id)
            .order_by(func.max(Price.date).desc(), func.count().desc())
            .limit(1)
        ).first()
        if freshest is None:
            return []

        commodity_id, latest_day, _ = freshest
        commodity_name = db.scalar(
            select(Commodity.name).where(Commodity.id == commodity_id)
        )
        latest_per_mandi = (
            select(Price.mandi_id.label("mandi_id"), func.max(Price.date).label("date"))
            .where(Price.commodity_id == commodity_id)
            .group_by(Price.mandi_id)
            .subquery()
        )
        rows = db.execute(
            select(Price, Mandi)
            .join(Mandi, Price.mandi_id == Mandi.id)
            .join(latest_per_mandi,
                  (Price.mandi_id == latest_per_mandi.c.mandi_id)
                  & (Price.date == latest_per_mandi.c.date))
            .where(Price.mandi_id.in_(select(Mandi.id).where(Mandi.state_id == state_id)),
                   Price.commodity_id == commodity_id)
            .order_by(Price.arrival_qty.desc().nulls_last(),
                      Price.modal_price.asc(), Mandi.name.asc())
            .limit(5)
        ).all()

        history = db.execute(
            select(Price.mandi_id, Price.date, Price.modal_price)
            .where(Price.commodity_id == commodity_id,
                   Price.mandi_id.in_([r.Price.mandi_id for r in rows]))
            .order_by(Price.mandi_id, Price.date.desc())
        ).all()
        trends: dict[int, list] = {}
        for mandi_id, _date, modal in history:
            series = trends.setdefault(mandi_id, [])
            if len(series) < 7:
                series.append(float(modal))

        return [
            {
                "mandi_id": r.Mandi.id,
                "mandi": r.Mandi.name,
                "commodity_id": commodity_id,
                "commodity": commodity_name,
                "modal_price": float(r.Price.modal_price),
                "arrival_qty": float(r.Price.arrival_qty)
                if r.Price.arrival_qty is not None else None,
                "trend_7d": list(reversed(trends.get(r.Price.mandi_id, []))),
                "date": r.Price.date.isoformat(),
            }
            for r in rows
        ]
    finally:
        db.close()


def _news(state_id: int) -> dict:
    db = SessionLocal()
    try:
        rows = db.scalars(
            select(News)
            .where(News.state_id == state_id)
            .order_by(News.published_at.desc().nulls_last(),
                      News.scraped_at.desc())
            .limit(5)
        ).all()
        if not rows:
            return _wrap("empty")
        newest = max(r.scraped_at or r.published_at for r in rows
                     if (r.scraped_at or r.published_at))
        stale = newest < dt.datetime.now(dt.timezone.utc) \
            - dt.timedelta(days=NEWS_FRESH_DAYS)
        return _wrap("stale" if stale else "ok", [
            {
                "id": r.id,
                "title": r.title,
                "summary": r.summary,
                "url": r.url,
                "image_url": r.image_url,
                "video_url": r.video_url,
                "publisher": r.publisher,
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "source_url": r.source_url,
                "scraped_at": r.scraped_at.isoformat() if r.scraped_at else None,
            }
            for r in rows
        ])
    finally:
        db.close()


def _fertilizer(state_id: int) -> dict:
    db = SessionLocal()
    try:
        rows = db.scalars(
            select(FertilizerPrice)
            .where(FertilizerPrice.state_id == state_id)
            .order_by(FertilizerPrice.product, FertilizerPrice.scraped_at.desc())
        ).all()
        if not rows:
            return _wrap("empty")

        # latest row per product + the one before it, for the delta vs last check
        seen: dict[str, list] = {}
        for r in rows:
            seen.setdefault(r.product, []).append(r)
        items = []
        for product, checks in sorted(seen.items()):
            cur, prev = checks[0], (checks[1] if len(checks) > 1 else None)
            delta_pct = None
            if prev is not None and prev.price:
                base = float(prev.price_per_kg or prev.price)
                now = float(cur.price_per_kg or cur.price)
                delta_pct = round((now - base) / base * 100, 1) if base else None
            items.append({
                "product": cur.product,
                "price": float(cur.price),
                "unit": cur.unit,
                "price_per_kg": float(cur.price_per_kg) if cur.price_per_kg else None,
                "delta_pct": delta_pct,
                "source_url": cur.source_url,
                "scraped_at": cur.scraped_at.isoformat() if cur.scraped_at else None,
            })

        stale = max(r.scraped_at for r in rows) < dt.datetime.now(dt.timezone.utc) \
            - dt.timedelta(days=FERTILIZER_FRESH_DAYS)
        return _wrap("stale" if stale else "ok", items)
    finally:
        db.close()


def _knowledge(state_id: int) -> dict:
    """Seeded sowing/harvest windows etc (DB-backed, never goes stale by itself).
    Shows the state's top crops; crops without coverage render an honest empty
    card frontend-side (PAGES.md)."""
    db = SessionLocal()
    try:
        rows = db.execute(
            select(CropKnowledge, Commodity)
            .join(Commodity, CropKnowledge.commodity_id == Commodity.id)
            .where(CropKnowledge.state_id == state_id)
            .order_by(Commodity.name)
        ).all()
        if not rows:
            return _wrap("empty")
        return _wrap("ok", [
            {
                "commodity": commodity.name,
                "sowing_window": k.sowing_window,
                "harvest_window": k.harvest_window,
                "districts": list(k.districts or []),
                "notes": k.notes,
            }
            for k, commodity in rows
        ])
    finally:
        db.close()


# -------------------------------------------------------------------- endpoint --


def _weather_section(state: State) -> dict:
    """weather_service.get_weather fails open (returns None on upstream outage);
    that maps to a 'failed' section here - an outage is not 'empty' (UI-DESIGN.md
    States: empty = legitimately none, failed = source died)."""
    if state.lat is None or state.lng is None:
        return _wrap("failed", error="state has no centroid - cannot place a weather query")
    payload = weather_service.get_weather(float(state.lat), float(state.lng))
    if payload is None:
        return _wrap("failed", error="open-meteo unavailable")
    return _wrap("ok", payload)


@router.get("/stats")
def stats():
    """Coverage counters for the landing page - docs/API.md."""
    db = SessionLocal()
    try:
        from models import Commodity, Mandi, Price, State
        mandis = db.scalar(select(func.count()).select_from(Mandi))
        states = db.scalar(select(func.count()).select_from(State))
        commodities = db.scalar(select(func.count()).select_from(Commodity))
        last_refreshed = db.scalar(select(func.max(Price.date)))
    finally:
        db.close()
    return {
        "mandis": mandis or 0,
        "states": states or 0,
        "commodities": commodities or 0,
        "last_refreshed": last_refreshed.isoformat() if last_refreshed else None,
    }


@router.get("/states")
def list_states():
    """All seeded states with centroids - powers the /state picker grid."""
    db = SessionLocal()
    try:
        rows = db.execute(
            select(State.id, State.name, State.lat, State.lng).order_by(State.name)
        ).all()
    finally:
        db.close()
    return [
        {
            "id": r.id,
            "name": r.name,
            "lat": float(r.lat) if r.lat is not None else None,
            "lng": float(r.lng) if r.lng is not None else None,
        }
        for r in rows
    ]


@router.get("/state/{state_id}")
def region_bundle(state_id: int):
    """The whole region page payload; sections degrade independently."""
    db = SessionLocal()
    try:
        state = db.scalars(select(State).where(State.id == state_id)).first()
        if state is None:
            raise HTTPException(status_code=404,
                                detail=f"unknown state id {state_id}")
        mandi_count = db.scalar(
            select(func.count()).select_from(Mandi).where(Mandi.state_id == state.id)
        )
    finally:
        db.close()

    sections = {
        # top_mandis stays a bare array - documented contract shape
        "top_mandis": lambda: _top_mandis(state.id),
        "weather": lambda: _weather_section(state),
        "news": lambda: _news(state.id),
        "fertilizer": lambda: _fertilizer(state.id),
        "knowledge": lambda: _knowledge(state.id),
    }

    pool = concurrent.futures.ThreadPoolExecutor(max_workers=len(sections))
    try:
        futures = {name: pool.submit(_safe, name, fn) for name, fn in sections.items()}
        results = {}
        for name, fut in futures.items():
            try:
                results[name] = fut.result(timeout=SECTION_TIMEOUT_S)
            except concurrent.futures.TimeoutError:
                log.warning("region section %r still running after %ss",
                            name, SECTION_TIMEOUT_S)
                results[name] = _wrap("failed",
                                      error=f"{name} timed out after "
                                            f"{SECTION_TIMEOUT_S}s")
    finally:
        # wait=False: never hold the response open for a hung source - the AC is
        # one slow/dead section must not sink the other four. The stray worker
        # finishes into the void and closes its own DB session.
        pool.shutdown(wait=False, cancel_futures=True)

    top_mandis = results["top_mandis"]
    # documented contract: top_mandis is a bare array. Its resolver is a pure DB
    # read - the only realistic failure (DB down) already fails the state lookup
    # above - so a failed wrapper here degrades to an empty array, never a shape break
    if isinstance(top_mandis, dict):
        top_mandis = []
    return {
        "state": {
            "id": state.id,
            "name": state.name,
            "lat": float(state.lat) if state.lat is not None else None,
            "lng": float(state.lng) if state.lng is not None else None,
            "mandi_count": mandi_count,
        },
        "top_mandis": top_mandis,
        **{k: v for k, v in results.items() if k != "top_mandis"},
    }


@router.get("/state/{state_id}/weather")
def state_weather(state_id: int):
    """Standalone weather endpoint (farmer console strip, PAGES.md)."""
    db = SessionLocal()
    try:
        state = db.scalars(select(State).where(State.id == state_id)).first()
    finally:
        db.close()
    if state is None:
        raise HTTPException(status_code=404, detail=f"unknown state id {state_id}")
    if state.lat is None or state.lng is None:
        raise HTTPException(status_code=404,
                            detail="state has no centroid - cannot place a weather query")
    payload = weather_service.get_weather(float(state.lat), float(state.lng))
    if payload is None:  # get_weather fails open; an outage is a real 502 here
        raise HTTPException(status_code=502, detail="weather upstream unavailable")
    return payload

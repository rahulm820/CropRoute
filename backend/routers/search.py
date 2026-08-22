"""GET /api/search - ranked sourcing options for one commodity (backlog #10).

Cheapest sourcing first: modal price ascending, arrival volume descending as the
secondary sort so better-supplied mandis break ties. Null arrivals sort last -
unreported volume must never outrank a real supply signal (models.Price.arrival_qty,
backlog #41: the baseline feed ships no arrivals yet).

One row per mandi: the latest reported day wins (uq_price_day keeps that unique).
Unknown item/state/no data all return 200 with an empty results array - never 404/500
(docs/API.md "Prices").
"""

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db.session import get_db
from models import Commodity, Mandi, Price, State
from services import search_cache

router = APIRouter()


def _resolve_commodity(db: Session, item: str) -> Commodity | None:
    """`item` accepts a commodity name (case-insensitive) or numeric id."""
    item = item.strip()
    stmt = select(Commodity)
    if item.isdigit():
        stmt = stmt.where(Commodity.id == int(item))
    else:
        stmt = stmt.where(func.lower(Commodity.name) == item.lower())
    return db.scalars(stmt).first()


def _resolve_state(db: Session, state: str) -> State | None:
    """`state` accepts a state name (case-insensitive) or numeric id."""
    state = state.strip()
    stmt = select(State)
    if state.isdigit():
        stmt = stmt.where(State.id == int(state))
    else:
        stmt = stmt.where(func.lower(State.name) == state.lower())
    return db.scalars(stmt).first()


def _trend_7d_pct(
    db: Session,
    commodity_id: int,
    latest_rows: list[dict],
) -> dict[int, float | None]:
    """% change of each mandi's modal price vs its own value ~7 days earlier.

    Per-mandi cutoff (that mandi's latest date minus 7d), not today - seeded/demo
    data can lag the calendar and must still produce trends. No baseline in range
    or zero baseline -> None.
    """
    mandi_ids = [r["mandi_id"] for r in latest_rows]
    if not mandi_ids:
        return {}

    per_mandi: dict[int, list[tuple[dt.date, Decimal]]] = {}
    for mandi_id, date, modal_price in db.execute(
        select(Price.mandi_id, Price.date, Price.modal_price).where(
            Price.commodity_id == commodity_id,
            Price.mandi_id.in_(mandi_ids),
        )
    ):
        per_mandi.setdefault(mandi_id, []).append((date, modal_price))

    trends: dict[int, float | None] = {}
    for row in latest_rows:
        mandi_id = row["mandi_id"]
        latest_date, latest_price = row["date"], Decimal(row["modal_price"])
        cutoff = latest_date - dt.timedelta(days=7)
        history_desc = sorted(per_mandi.get(mandi_id, []), reverse=True)
        baseline = next((p for d, p in history_desc if d <= cutoff), None)
        if baseline is None or baseline == 0:
            trends[mandi_id] = None
        else:
            trends[mandi_id] = round(float((latest_price - baseline) / baseline * 100), 2)
    return trends


@router.get("/search")
def search_prices(
    item: str = Query(..., description="Commodity name (case-insensitive) or id"),
    state: str | None = Query(None, description="State name (case-insensitive) or id"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Ranked mandis for `item`, optionally within one `state`.

    Cheapest first (modal asc), arrivals desc as tiebreak, nulls last.
    Empty result set -> 200 {"item": ..., "last_refreshed": null, "results": []}.
    """
    commodity = _resolve_commodity(db, item)
    state_given = bool(state and state.strip())
    state_row = _resolve_state(db, state) if state_given else None

    # unknown item or unknown state -> no data; 200 with an empty array, never 404
    if commodity is None or (state_given and state_row is None):
        return {
            "item": commodity.name if commodity else item.strip(),
            "last_refreshed": None,
            "results": [],
        }

    filters = [Price.commodity_id == commodity.id]
    if state_row is not None:
        filters.append(Mandi.state_id == state_row.id)

    # cache only fully-resolved queries; the unknown-item/state paths above are
    # already cheap and would need their own key space for the echoed raw input
    key = search_cache.cache_key(
        commodity.id, state_row.id if state_row is not None else None, limit
    )
    cached = search_cache.get_cached(key)
    if cached is not None:
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    # latest reported day per mandi; uq_price_day makes that day's row unique
    latest_day = (
        select(Price.mandi_id.label("mandi_id"), func.max(Price.date).label("date"))
        .join(Mandi, Price.mandi_id == Mandi.id)
        .where(*filters)
        .group_by(Price.mandi_id)
        .subquery()
    )

    rows = db.execute(
        select(Price, Mandi, State)
        .join(Mandi, Price.mandi_id == Mandi.id)
        .join(State, Mandi.state_id == State.id)
        .join(
            latest_day,
            (Price.mandi_id == latest_day.c.mandi_id) & (Price.date == latest_day.c.date),
        )
        .where(*filters)
        .order_by(
            Price.modal_price.asc(),
            Price.arrival_qty.desc().nulls_last(),
            Mandi.name.asc(),  # deterministic tiebreak
        )
        .limit(limit)
    ).all()

    latest_rows = [
        {"mandi_id": r.Price.mandi_id, "date": r.Price.date, "modal_price": r.Price.modal_price}
        for r in rows
    ]
    trends = _trend_7d_pct(db, commodity.id, latest_rows)

    results = [
        {
            "mandi_id": r.Mandi.id,
            "mandi": r.Mandi.name,
            "state_id": r.State.id,
            "state": r.State.name,
            "lat": float(r.Mandi.lat) if r.Mandi.lat is not None else None,
            "lng": float(r.Mandi.lng) if r.Mandi.lng is not None else None,
            "min_price": float(r.Price.min_price) if r.Price.min_price is not None else None,
            "max_price": float(r.Price.max_price) if r.Price.max_price is not None else None,
            "modal_price": float(r.Price.modal_price),
            "arrival_qty": float(r.Price.arrival_qty) if r.Price.arrival_qty is not None else None,
            "unit": "quintal",
            "trend_7d_pct": trends.get(r.Price.mandi_id),
            "date": r.Price.date.isoformat(),
        }
        for r in rows
    ]

    last_refreshed = max((r["date"] for r in latest_rows), default=None)
    payload = {
        "item": commodity.name,
        "last_refreshed": last_refreshed.isoformat() if last_refreshed else None,
        "results": results,
    }
    search_cache.set_cached(key, payload)
    return JSONResponse(content=payload, headers={"X-Cache": "MISS"})

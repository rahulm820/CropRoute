"""GET /api/mandi/:id — mandi detail with lazy-enriched dealer contacts.

First request for an un-enriched mandi blocks on a live Bright Data scrape
(~30-60s); subsequent requests serve from the dealers table (<200ms).  Every
dealer row carries source_url + scraped_at.  The enrichment.status field
tells the frontend whether to show a spinner, warning, or nothing.

docs/API.md § GET /api/mandi/:id
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from db.session import get_db
from models import Commodity, Mandi, Price
from services.enrichment_service import (
    enrich_mandi,
    get_enrichment_status,
)

router = APIRouter()


def _latest_prices(db: Session, mandi_id: int) -> list[dict]:
    """Latest price row per commodity at this mandi (one day per commodity)."""
    subq = (
        select(
            Price.commodity_id,
            Price.date,
        )
        .where(Price.mandi_id == mandi_id)
        .group_by(Price.commodity_id, Price.date)
        .order_by(Price.commodity_id, desc(Price.date))
        .subquery()
    )

    rows = db.execute(
        select(Price, Commodity)
        .join(Commodity, Price.commodity_id == Commodity.id)
        .join(
            subq,
            (Price.commodity_id == subq.c.commodity_id)
            & (Price.date == subq.c.date),
        )
        .where(Price.mandi_id == mandi_id)
        .order_by(Commodity.name)
    ).all()

    return [
        {
            "commodity": r.Commodity.name,
            "modal_price": float(r.Price.modal_price),
            "arrival_qty": float(r.Price.arrival_qty) if r.Price.arrival_qty is not None else None,
            "date": r.Price.date.isoformat(),
        }
        for r in rows
    ]


def _office_from_dealers(dealers: list[dict]) -> dict | None:
    """The first dealer with role containing 'office' is the market office."""
    for d in dealers:
        role = (d.get("role") or "").lower()
        if "office" in role or "committee" in role:
            return {
                "address": None,  # not in the dealer schema; can be enriched later
                "phone": d.get("phone"),
                "source_url": d.get("source_url"),
                "scraped_at": d.get("scraped_at"),
            }
    return None


@router.get("/mandi/{mandi_id}")
def get_mandi(mandi_id: int, db: Session = Depends(get_db)):
    """Full mandi detail bundle.

    Enrichment runs lazily: if dealer data is stale or missing, a live
    Bright Data scrape is triggered before the response is returned.  Set
    query param ``force_refresh=1`` to bypass the cache.
    """
    mandi = db.get(Mandi, mandi_id)
    if mandi is None:
        raise HTTPException(status_code=404, detail=f"mandi {mandi_id} not found")

    # --- prices ---
    prices = _latest_prices(db, mandi_id)

    # --- dealers (lazy enrichment) ---
    dealers = enrich_mandi(db, mandi_id)
    enrichment = get_enrichment_status(db, mandi_id)

    return {
        "mandi": {
            "id": mandi.id,
            "name": mandi.name,
            "state": mandi.state.name if mandi.state else None,
            "lat": float(mandi.lat) if mandi.lat is not None else None,
            "lng": float(mandi.lng) if mandi.lng is not None else None,
        },
        "prices": prices,
        "office": _office_from_dealers(dealers),
        "dealers": dealers,
        "enrichment": enrichment,
    }

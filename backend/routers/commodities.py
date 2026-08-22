"""Commodity list endpoint - powers the landing-page autocomplete."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db.session import get_db
from models import Commodity

router = APIRouter()


@router.get("/commodities")
def list_commodities(db: Session = Depends(get_db)):
    """Return every tracked commodity as {id, name, category}.

    ~19 rows on a warm DB. No pagination needed; the frontend renders all of
    them as autocomplete suggestions.
    """
    rows = db.scalars(select(Commodity).order_by(Commodity.name)).all()
    return [{"id": c.id, "name": c.name, "category": c.category} for c in rows]

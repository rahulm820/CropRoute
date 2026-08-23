"""POST /api/posts — farmer price reports (issue #23, docs/API.md "Users and feed").

Farmer-only endpoint.  Validates:
  1. Bearer token is present and belongs to a farmer (403 otherwise).
  2. price > 0 (DB check constraint also enforces this).
  3. price is within 10x the last known modal price for the commodity —
     a fat-fingered 231000 must not poison the feed.

UGC posts never carry provenance chips; the UI renders an "unverified" badge
instead (CLAUDE.md).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db.session import get_db
from models import Commodity, Mandi, Post, Price, State, User
from services.auth_service import require_farmer

router = APIRouter()

_PRICE_RATIO_LIMIT = 10


class PostRequest(BaseModel):
    commodity_id: int
    mandi_id: int | None = None
    price: float
    note: str | None = None
    image_url: str | None = None


def _post_dict(p: Post) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "commodity_id": p.commodity_id,
        "mandi_id": p.mandi_id,
        "state_id": p.state_id,
        "price": float(p.price),
        "note": p.note,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _last_modal_price(db: Session, commodity_id: int) -> float | None:
    """Most recent modal price for this commodity across all mandis."""
    row = db.execute(
        select(Price.modal_price)
        .where(Price.commodity_id == commodity_id)
        .order_by(Price.date.desc())
        .limit(1)
    ).first()
    return float(row[0]) if row else None


@router.post("/posts", status_code=status.HTTP_201_CREATED)
def create_post(body: PostRequest, user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    """Create a farmer price report.

    Only farmers may post.  Price must be positive and within 10x the last
    known modal price for the commodity (fat-finger guard per API.md).
    """
    if body.price <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="price must be greater than zero",
        )

    # --- price validation against last known modal ---
    last_modal = _last_modal_price(db, body.commodity_id)
    if last_modal is not None and last_modal > 0:
        ratio = body.price / last_modal
        if ratio > _PRICE_RATIO_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"price {body.price} is {ratio:.1f}x the last known modal "
                    f"price ({last_modal:.0f}) — maximum allowed is "
                    f"{_PRICE_RATIO_LIMIT}x"
                ),
            )

    # --- validate FK refs exist ---
    commodity = db.get(Commodity, body.commodity_id)
    if commodity is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown commodity_id {body.commodity_id}",
        )

    if body.mandi_id is not None:
        mandi = db.get(Mandi, body.mandi_id)
        if mandi is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"unknown mandi_id {body.mandi_id}",
            )
        state_id = mandi.state_id
    else:
        state_id = user.state_id
        if state_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="mandi_id is required when user has no state_id",
            )

    state = db.get(State, state_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown state_id {state_id}",
        )

    post = Post(
        user_id=user.id,
        commodity_id=body.commodity_id,
        mandi_id=body.mandi_id,
        state_id=state_id,
        price=body.price,
        note=body.note,
        image_url=body.image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return _post_dict(post)

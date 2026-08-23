"""GET /api/feed -- merged reverse-chronological stream of farmer posts and
scraped news (issue #40, docs/API.md "Users and feed").

Filters: state, commodity, type (all|post|limit).  Each item carries a ``kind``
field so the frontend renders the right card variant.
"""

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, union_all
from sqlalchemy.orm import Session

from db.session import get_db
from models import Commodity, News, Post, State, User

router = APIRouter()

FRESHNESS_DAYS = 14


def _post_row(p: Post, user: User | None, commodity: Commodity | None, state: State | None) -> dict:
    return {
        "kind": "post",
        "id": p.id,
        "author": user.name if user else None,
        "state": state.name if state else None,
        "commodity": commodity.name if commodity else None,
        "price": float(p.price),
        "note": p.note,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _news_row(n: News, state: State | None) -> dict:
    return {
        "kind": "news",
        "id": n.id,
        "title": n.title,
        "publisher": n.publisher,
        "url": n.url,
        "image_url": n.image_url,
        "video_url": n.video_url,
        "source_url": n.source_url,
        "scraped_at": n.scraped_at.isoformat() if n.scraped_at else None,
    }


@router.get("/feed")
def get_feed(
    state: int | None = Query(None, description="State id filter"),
    commodity: int | None = Query(None, description="Commodity id filter"),
    type: str = Query("all", description="all | post | news"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Merged, reverse-chronological feed of posts + news."""
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=FRESHNESS_DAYS)
    items: list[dict] = []

    # --- posts ---
    if type in ("all", "post"):
        post_filters = [Post.created_at >= cutoff]
        if state is not None:
            post_filters.append(Post.state_id == state)
        if commodity is not None:
            post_filters.append(Post.commodity_id == commodity)

        posts = db.scalars(
            select(Post).where(*post_filters).order_by(Post.created_at.desc()).limit(limit)
        ).all()

        for p in posts:
            user = db.get(User, p.user_id) if p.user_id else None
            commodity_row = db.get(Commodity, p.commodity_id) if p.commodity_id else None
            state_row = db.get(State, p.state_id) if p.state_id else None
            items.append(_post_row(p, user, commodity_row, state_row))

    # --- news ---
    if type in ("all", "news"):
        news_filters = [News.scraped_at >= cutoff]
        if state is not None:
            news_filters.append(News.state_id == state)

        news = db.scalars(
            select(News).where(*news_filters).order_by(News.published_at.desc().nulls_last()).limit(limit)
        ).all()

        for n in news:
            state_row = db.get(State, n.state_id) if n.state_id else None
            items.append(_news_row(n, state_row))

    # --- sort merged feed reverse-chronologically ---
    def _sort_key(item: dict) -> str:
        if item["kind"] == "post":
            return item.get("created_at") or ""
        return item.get("scraped_at") or ""

    items.sort(key=_sort_key, reverse=True)
    return items[:limit]

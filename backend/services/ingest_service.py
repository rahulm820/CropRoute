"""Ingest: map raw Bright Data rows onto domain tables (issue #18's write half).

brightdata_service returns whatever dicts the collector was configured to
extract; mapping them onto news / fertilizer_prices lives here so transport
stays schema-agnostic. Field names vary between collectors, so every mapper
picks tolerantly across common spellings before giving up on a row.

Dealers keep their own lazy path (enrichment_service). Price-feed collectors
(commodity_name/modal_price) flow into the prices table via the Agmarknet
refresh path and stay completeness-only here for now.

Configs opt in with a "kind" field in scrapers/<name>.json. Every written row
carries source_url + scraped_at + collector (CLAUDE.md provenance rule), so the
frontend ProvenanceChip works without special cases.
"""

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import FertilizerPrice, News, State

log = logging.getLogger(__name__)

# scrapers name the same concept differently; try each spelling in order
_TITLE_KEYS = ("headline", "title", "heading")
_URL_KEYS = ("url", "link", "article_url")
_SUMMARY_KEYS = ("summary", "description", "excerpt", "subheadline")
_IMAGE_KEYS = ("image", "image_url", "img", "thumbnail", "og_image")
_VIDEO_KEYS = ("video", "video_url", "embed", "youtube_url")
_PUBLISHER_KEYS = ("publisher", "site", "source_name")
_PUBLISHED_KEYS = ("published", "published_at", "date", "published_date")
_PRODUCT_KEYS = ("product_name", "fertilizer_name", "name", "title")
_PRICE_KEYS = ("price", "mrp", "market_price", "cost")
_PACK_KEYS = ("pack_size", "unit", "size", "package")

_KG_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)", re.IGNORECASE)


def _pick(row: dict, keys):
    """First non-empty value among candidate keys, or None."""
    for key in keys:
        value = row.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def _clean_str(value, limit: int | None = None) -> str | None:
    if value in (None, "", [], {}):
        return None
    text = str(value).strip()
    return text[:limit] if limit and len(text) > limit else (text or None)


def _parse_dt(value):
    """ISO-ish timestamps; anything unparseable stays null rather than guessed."""
    text = _clean_str(value)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _money(value) -> Decimal | None:
    """'₹1,350.50', '1350 INR', 'Rs. 266.5' -> Decimal('1350.50')."""
    text = _clean_str(value)
    if not text:
        return None
    digits = re.sub(r"[^0-9.]", "", text)
    if not digits or digits == ".":
        return None
    try:
        return Decimal(digits)
    except InvalidOperation:
        return None


def resolve_state_id(db: Session, cfg: dict, collector_name: str) -> int | None:
    """Config 'state' wins; otherwise the registry-name prefix ('punjab_...' ->
    Punjab). Unresolvable -> None and the caller skips ingest honestly."""
    candidates = []
    if cfg.get("state"):
        candidates.append(str(cfg["state"]))
    prefix = collector_name.split("_")[0]
    if prefix:
        candidates.append(prefix.capitalize())
    for candidate in candidates:
        state = db.scalars(
            select(State).where(State.name.ilike(candidate))
        ).first()
        if state is not None:
            return state.id
    log.warning("collector %s: cannot resolve state %s - ingest skipped",
                collector_name, candidates)
    return None


def ingest_news(db: Session, state_id: int, rows: list[dict], *,
                collector: str, source_url: str) -> tuple[int, int]:
    """Upsert news by URL (uq_news_url). Returns (inserted, updated)."""
    now = datetime.now(timezone.utc)
    inserted = updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        url = _clean_str(_pick(row, _URL_KEYS))
        title = _clean_str(_pick(row, _TITLE_KEYS), 500)
        if not url or not title:
            continue  # both feed the card and the unique key - thin rows are dropped
        publisher = (_clean_str(_pick(row, _PUBLISHER_KEYS), 120)
                     or urlparse_host(url))
        fields = {
            "title": title,
            "summary": _clean_str(_pick(row, _SUMMARY_KEYS), 600),
            "image_url": _clean_str(_pick(row, _IMAGE_KEYS)),
            "video_url": _clean_str(_pick(row, _VIDEO_KEYS)),
            "publisher": publisher,
            "published_at": _parse_dt(_pick(row, _PUBLISHED_KEYS)),
        }
        existing = db.scalars(select(News).where(News.url == url)).first()
        if existing is None:
            db.add(News(
                state_id=state_id,
                url=url,
                source_url=source_url or url,
                scraped_at=now,
                collector=collector[:60],
                **fields,
            ))
            inserted += 1
        elif any(getattr(existing, k) != v for k, v in fields.items()):
            for key, value in fields.items():
                setattr(existing, key, value)
            existing.scraped_at = now
            updated += 1
    return inserted, updated


def urlparse_host(url: str) -> str | None:
    from urllib.parse import urlparse
    host = urlparse(url).hostname
    return host.removeprefix("www.") if host else None


def ingest_fertilizer(db: Session, state_id: int, rows: list[dict], *,
                      collector: str, source_url: str) -> int:
    """Append fertilizer snapshots. No unique constraint on the table: runs are
    dated snapshots and section queries take latest-per-product."""
    now = datetime.now(timezone.utc)
    added = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        product = _clean_str(_pick(row, _PRODUCT_KEYS), 80)
        price = _money(_pick(row, _PRICE_KEYS))
        if not product or price is None or price <= 0:
            continue
        pack = _clean_str(_pick(row, _PACK_KEYS), 40) or "unspecified"
        kg_match = _KG_RE.search(pack)
        price_per_kg = (price / Decimal(kg_match.group(1))
                        if kg_match and Decimal(kg_match.group(1)) > 0 else None)
        db.add(FertilizerPrice(
            state_id=state_id,
            product=product,
            price=price,
            unit=pack,
            price_per_kg=price_per_kg.quantize(Decimal("0.0001")) if price_per_kg else None,
            source_url=source_url or None,
            scraped_at=now,
        ))
        added += 1
    return added


def ingest_rows(db: Session, name: str, cfg: dict, rows: list[dict]) -> int | None:
    """Dispatch one collector run's rows by config kind.

    Returns rows persisted, or None when the config declares no kind
    (completeness-only collectors). Never raises past the monitor."""
    kind = str(cfg.get("kind") or "").strip().lower()
    if kind not in ("news", "fertilizer"):
        return None
    if not isinstance(rows, list) or not rows:
        return 0
    state_id = resolve_state_id(db, cfg, name)
    if state_id is None:
        return 0
    source_url = str(cfg.get("target_url") or "")
    if kind == "news":
        inserted, updated = ingest_news(
            db, state_id, rows, collector=name, source_url=source_url)
        if inserted or updated:
            db.commit()
        log.info("collector %s: news ingest +%d/~%d", name, inserted, updated)
        return inserted + updated
    added = ingest_fertilizer(
        db, state_id, rows, collector=name, source_url=source_url)
    if added:
        db.commit()
    log.info("collector %s: fertilizer ingest +%d", name, added)
    return added

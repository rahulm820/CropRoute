"""Redis cache for GET /api/search - issue #11.

Keyed by resolved commodity id + state id + limit, so "wheat"/"WHEAT"/"1" share one
entry and different limits never collide. TTL equals the baseline refresh interval
(REFRESH_INTERVAL_HOURS, default 8, clamped to [6,12] - the same rule as
services/refresh_job._interval_hours), so entries expire naturally right around when
new data lands; run_refresh() additionally invalidates explicitly on completion, which
bounds staleness to min(TTL, next refresh).

Fail-open by design: every Redis operation is best-effort. If Redis is down the search
endpoint still answers from Postgres - a cache outage must never become a 500.
"""

import json
import logging
import os

import redis

log = logging.getLogger(__name__)

_KEY_PREFIX = "search:v1"


def _client() -> redis.Redis:
    return redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )


_r = _client()


def ttl_seconds() -> int:
    """Cache lifetime = one baseline refresh interval (see module docstring)."""
    raw = os.getenv("REFRESH_INTERVAL_HOURS", "8").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 8
    return min(max(hours, 6), 12) * 3600


def cache_key(commodity_id: int, state_id: int | None, limit: int) -> str:
    return f"{_KEY_PREFIX}:c{commodity_id}:s{state_id if state_id is not None else 'all'}:l{limit}"


def get_cached(key: str) -> dict | None:
    try:
        raw = _r.get(key)
    except Exception:  # noqa: BLE001 - fail open: redis.RedisError, timeouts, DNS...
        log.warning("search cache get failed - serving from db", exc_info=True)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        log.warning("search cache entry %s was not valid json - ignoring", key)
        return None


def set_cached(key: str, payload: dict) -> None:
    try:
        _r.set(key, json.dumps(payload), ex=ttl_seconds())
    except Exception:  # noqa: BLE001 - fail open
        log.warning("search cache set failed - continuing without cache", exc_info=True)


def invalidate_all() -> int:
    """Drop every cached search result. Called when run_refresh() lands new prices so
    the next request recomputes from Postgres instead of serving pre-refresh rows."""
    deleted = 0
    try:
        keys = list(_r.scan_iter(match=f"{_KEY_PREFIX}:*", count=100))
        if keys:
            deleted = _r.delete(*keys)
    except Exception:  # noqa: BLE001 - fail open: TTL expiry still bounds staleness
        log.warning("search cache invalidation failed - relying on ttl expiry", exc_info=True)
        return 0
    log.info("invalidated %d search cache entr%s", deleted, "y" if deleted == 1 else "ies")
    return deleted

"""Open-Meteo weather service — issue #14, docs/DATA-SOURCES.md §5.

Fetches current + 7-day forecast at a state centroid, maps WMO weather codes to
the seven UI conditions, and caches for 1 hour in Redis.

No API key required.  Fail-open: Redis or HTTP failures degrade to None rather
than 500 — the caller renders an empty weather card.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx
import redis

log = logging.getLogger(__name__)

BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL = 3600  # 1 hour per DATA-SOURCES.md §5
HEADERS = {"User-Agent": "CropRoute/0.1 (weather)"}

# ---------------------------------------------------------------------------
# WMO weather interpretation codes → our 7 UI conditions
# https://open-meteo.com/en/docs#weathervariables
# ---------------------------------------------------------------------------

# WMO 0-3 are "sky condition" codes; 45-48 fog; 51-67 precip; 80-82 showers;
# 95-99 thunderstorm.  `hot` is derived (sunny + max_c >= 40), not a code.
_WMO_MAP: dict[int, str] = {
    0: "sunny",
    1: "sunny",
    2: "partly-cloudy",
    3: "cloudy",
    # fog
    45: "fog",
    48: "fog",
    # drizzle
    51: "rain",
    53: "rain",
    55: "rain",
    56: "rain",  # freezing drizzle
    57: "rain",
    # rain
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",  # freezing rain
    67: "rain",
    # showers
    80: "rain",
    81: "rain",
    82: "rain",
    # thunderstorm
    95: "thunderstorm",
    96: "thunderstorm",  # thunderstorm + hail
    99: "thunderstorm",
}

CONDITIONS = ("sunny", "partly-cloudy", "cloudy", "rain", "thunderstorm", "fog", "hot")


def wmo_to_condition(code: int, max_c: float | None = None) -> str:
    """Map a WMO weather code to one of the seven UI conditions.

    `hot` is derived: the base mapping must be ``sunny`` AND ``max_c >= 40``.
    Unknown codes fall back to ``cloudy``.
    """
    condition = _WMO_MAP.get(code, "cloudy")
    if condition == "sunny" and max_c is not None and max_c >= 40:
        return "hot"
    return condition


# ---------------------------------------------------------------------------
# Redis cache  (fail-open pattern — same as search_cache.py)
# ---------------------------------------------------------------------------

_KEY_PREFIX = "weather:v1"


def _redis() -> redis.Redis:
    return redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )


_r = _redis()


def _cache_key(lat: float, lng: float) -> str:
    return f"{_KEY_PREFIX}:{lat:.4f}:{lng:.4f}"


def _get_cached(key: str) -> dict | None:
    try:
        raw = _r.get(key)
    except Exception:  # noqa: BLE001
        log.warning("weather cache get failed", exc_info=True)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def _set_cached(key: str, payload: dict) -> None:
    try:
        _r.set(key, json.dumps(payload), ex=CACHE_TTL)
    except Exception:  # noqa: BLE001
        log.warning("weather cache set failed", exc_info=True)


# ---------------------------------------------------------------------------
# Open-Meteo HTTP client
# ---------------------------------------------------------------------------

def _fetch(lat: float, lng: float) -> dict:
    """One Open-Meteo call.  Retries on 5xx / network errors, fails fast on 4xx."""
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
        "forecast_days": 7,
    }
    last = None
    for attempt in range(3):
        try:
            r = httpx.get(BASE_URL, params=params, headers=HEADERS, timeout=15.0)
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After") or 2 ** attempt)
                log.warning("open-meteo rate limited, retrying in %.0fs", wait)
                time.sleep(wait)
                continue
            if 400 <= r.status_code < 500:
                raise WeatherError(f"open-meteo returned {r.status_code}: {r.text[:200]}")
            r.raise_for_status()
            return r.json()
        except WeatherError:
            raise
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            last = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise WeatherError(f"open-meteo unreachable after 3 attempts: {last}")


class WeatherError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_weather(lat: float, lng: float) -> dict | None:
    """Return formatted weather for a state centroid, or None on failure.

    Response shape matches docs/API.md § GET /api/state/:id/weather::

        {
          "current": {"temp_c": ..., "condition": ..., "humidity": ..., "wind_kph": ...},
          "daily": [{"date": ..., "min_c": ..., "max_c": ..., "condition": ..., "rain_mm": ...}],
          "source_url": "https://open-meteo.com/",
          "fetched_at": "..."
        }
    """
    key = _cache_key(lat, lng)
    cached = _get_cached(key)
    if cached is not None:
        return cached

    try:
        raw = _fetch(lat, lng)
    except WeatherError as exc:
        log.error("open-meteo fetch failed: %s", exc)
        return None

    now = datetime.now(timezone.utc).isoformat()

    # --- current ---
    cur = raw.get("current", {})
    cur_code = cur.get("weather_code", -1)
    cur_temp = cur.get("temperature_2m")
    current = {
        "temp_c": cur_temp,
        "condition": wmo_to_condition(cur_code, max_c=cur_temp),
        "humidity": cur.get("relative_humidity_2m"),
        "wind_kph": cur.get("wind_speed_10m"),
    }

    # --- daily ---
    daily_codes = raw.get("daily", {}).get("weather_code", [])
    daily_max = raw.get("daily", {}).get("temperature_2m_max", [])
    daily_min = raw.get("daily", {}).get("temperature_2m_min", [])
    daily_rain = raw.get("daily", {}).get("precipitation_sum", [])
    daily_dates = raw.get("daily", {}).get("time", [])

    daily = []
    for i in range(len(daily_dates)):
        max_temp = daily_max[i] if i < len(daily_max) else None
        daily.append({
            "date": daily_dates[i],
            "min_c": daily_min[i] if i < len(daily_min) else None,
            "max_c": max_temp,
            "condition": wmo_to_condition(
                daily_codes[i] if i < len(daily_codes) else -1,
                max_c=max_temp,
            ),
            "rain_mm": daily_rain[i] if i < len(daily_rain) else None,
        })

    payload = {
        "current": current,
        "daily": daily,
        "source_url": "https://open-meteo.com/",
        "fetched_at": now,
    }
    _set_cached(key, payload)
    return payload

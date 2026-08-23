"""Nominatim geocoding for mandis -- backlog #42.

Resolves mandi locations to lat/lng using the Nominatim API (free, ODbL
attribution required).  Falls back to state centroid when Nominatim
cannot find a specific mandi.  Rate-limited to 1 req/s per Nominatim
usage policy.
"""

import logging
import time

import httpx

log = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "Punjab": (30.9022, 75.8573),
    "Madhya Pradesh": (23.2599, 77.4126),
    "Uttar Pradesh": (26.8467, 80.9462),
    "Maharashtra": (19.7515, 75.7139),
    "Rajasthan": (27.0238, 74.2179),
    "Gujarat": (22.2587, 71.1924),
    "West Bengal": (22.9868, 87.8550),
    "Andhra Pradesh": (15.9129, 79.7400),
    "Karnataka": (15.3173, 75.7139),
    "Tamil Nadu": (11.1271, 78.6569),
    "Bihar": (25.0961, 85.3131),
    "Odisha": (20.9517, 85.0985),
    "Telangana": (18.1124, 79.0193),
    "Kerala": (10.8505, 76.2711),
    "Assam": (26.2006, 92.9376),
    "Chhattisgarh": (21.2787, 81.8661),
    "Jharkhand": (23.6102, 85.2799),
    "Uttarakhand": (30.0668, 79.0193),
    "Himachal Pradesh": (31.1048, 77.1734),
    "Haryana": (29.0588, 76.0856),
    "Goa": (15.2993, 74.1240),
}


def geocode_mandi(
    mandi_name: str,
    district: str | None = None,
    state: str | None = None,
) -> dict | None:
    """Return {"lat": float, "lng": float} for a mandi, or None on failure.

    Query order: "mandi, district, state, India" -> falls back to state
    centroid if Nominatim returns nothing.
    """
    parts = [mandi_name]
    if district:
        parts.append(district)
    if state:
        parts.append(state)
    parts.append("India")
    query = ", ".join(parts)

    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "in"},
            headers={"User-Agent": "CropRoute/0.1 (geocoding)"},
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
    except Exception:
        log.warning("nominatim lookup failed for %r", query, exc_info=True)

    # --- fallback to state centroid ---
    if state and state in _STATE_CENTROIDS:
        lat, lng = _STATE_CENTROIDS[state]
        return {"lat": lat, "lng": lng}

    return None


def geocode_mandis(
    mandis: list[dict],
    delay_s: float = 1.1,
) -> list[dict]:
    """Batch-geocode a list of mandi dicts.

    Each dict must have ``name`` and optionally ``district``, ``state``.
    Adds ``lat`` and ``lng`` keys in-place.  Respects Nominatim rate limit.
    Returns the same list for convenience.
    """
    for m in mandis:
        coords = geocode_mandi(
            m["name"],
            district=m.get("district"),
            state=m.get("state"),
        )
        if coords:
            m["lat"] = coords["lat"]
            m["lng"] = coords["lng"]
        time.sleep(delay_s)
    return mandis

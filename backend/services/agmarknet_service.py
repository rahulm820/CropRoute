"""data.gov.in / Agmarknet daily mandi prices - the baseline price feed.

Dataset: "Current Daily Price of Various Commodities from Various Markets (Mandi)".
Returns one normalized dict per (state, mandi, date), ready for the prices table.

This is the one government data source in the project, and it stays in scope
specifically because it's an official, licensed API call - no HTML parsing, no page
rendering, no portal touched. Per docs/DATA-SOURCES.md Rule #1, we do not scrape
government websites; this module is the pattern for how government data is allowed in
at all.

Two things about this source shape the code (see docs/DATA-SOURCES.md):

1. It carries NO arrival quantity. The resource has state, district, market, commodity,
   variety, grade, arrival_date, min/max/modal price - that is all. `arrival_qty` is
   therefore always None here, and stays that way: filling it would require scraping
   the Agmarknet portal itself, which is a government website and is out of scope
   (see docs/DATA-SOURCES.md Rule #1 and Rule #7). This is an accepted permanent gap,
   not a TODO - ranking and UI code must treat null arrivals as "unknown", never
   coerce to 0.
2. It returns one row per variety AND grade, so a single market reports the same
   commodity several times on the same day. We aggregate to one row per market per day,
   because prices.uq_price_day allows exactly one.
"""

import logging
import os
import time
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from statistics import median

import httpx

log = logging.getLogger(__name__)

DATASET_ID = "9ef84268-d588-465a-a308-a864a43d0070"
BASE_URL = f"https://api.data.gov.in/resource/{DATASET_ID}"

# data.gov.in's published sample key. Works without registration but caps `limit` at 10
# rows per request, so a full pull needs a real key from https://data.gov.in/user/register
DEMO_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"

# data.gov.in's WAF black-holes the default python-httpx User-Agent: the request hangs
# until it times out rather than returning an error. Any descriptive UA is accepted.
# Do not remove this header - the failure it prevents looks like a network outage.
HEADERS = {"User-Agent": "CropRoute/0.1 (mandi price aggregator)"}

# Our display names (db.seed) -> the exact strings Agmarknet uses. Their names carry
# variety and processing state in parentheses; ours do not.
AGMARKNET_NAMES = {
    "wheat": "Wheat",
    "rice": "Rice",
    "paddy": "Paddy(Dhan)(Common)",
    "maize": "Maize",
    "bajra": "Bajra(Pearl Millet/Cumbu)",
    "jowar": "Jowar(Sorghum)",
    "gram": "Bengal Gram(Gram)(Whole)",
    "tur": "Arhar (Tur/Red Gram)(Whole)",
    "moong": "Green Gram (Moong)(Whole)",
    "masoor": "Masur Dal",
    "urad": "Black Gram (Urd Beans)(Whole)",
    "soybean": "Soyabean",
    "mustard": "Mustard",
    "groundnut": "Groundnut",
    "onion": "Onion",
    "potato": "Potato",
    "tomato": "Tomato",
    "cotton": "Cotton",
    "sugarcane": "Sugarcane",
}

MISSING = {"", "-", "NR", "N/A", "NA", "null", "None"}


class AgmarknetError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.getenv("DATA_GOV_API_KEY", "").strip()
    if not key:
        log.warning("DATA_GOV_API_KEY unset - using the public demo key (10 rows per request)")
        return DEMO_KEY
    return key


def _price(value) -> Decimal | None:
    """Agmarknet sends numbers, numeric strings, and placeholders for 'not reported'."""
    if value is None or (isinstance(value, str) and value.strip() in MISSING):
        return None
    try:
        return Decimal(str(value).replace(",", "").strip())
    except InvalidOperation:
        return None


def _parse_date(value: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def _mandi_name(raw: str) -> str:
    """'Dehgam(Rekhiyal) APMC' -> 'Dehgam'.

    The suffix and the parenthetical are the same market spelled differently across
    rows and across years. Strip them for the canonical name and keep the raw string in
    mandis.aliases so a later ingest still matches. See docs/DATA-SOURCES.md.
    """
    name = raw.strip()
    for suffix in (" APMC", " Apmc", " Mandi", " Market"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    if "(" in name:
        name = name.split("(", 1)[0]
    return " ".join(name.split()).strip(" ,-") or raw.strip()


def _get(params: dict, retries: int = 3, timeout: float = 30.0) -> dict:
    """One API call. 4xx fails fast (except 429), 5xx and network errors retry."""
    last = None
    for attempt in range(retries):
        try:
            r = httpx.get(BASE_URL, params=params, headers=HEADERS, timeout=timeout)
            # 429 is the one 4xx worth waiting out - the demo key rate-limits quickly
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After") or 2**attempt)
                log.warning("data.gov.in rate limited, retrying in %.0fs", wait)
                time.sleep(wait)
                last = AgmarknetError("rate limited")
                continue
            if 400 <= r.status_code < 500:
                raise AgmarknetError(f"data.gov.in returned {r.status_code}: {r.text[:200]}")
            r.raise_for_status()
            return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            last = exc
            if attempt < retries - 1:
                time.sleep(2**attempt)
    raise AgmarknetError(f"data.gov.in unreachable after {retries} attempts: {last}")


def _fetch_raw(commodity: str, state: str | None, page_size: int, max_records: int | None) -> list[dict]:
    key = _api_key()
    params = {
        "api-key": key,
        "format": "json",
        "limit": page_size,
        "filters[commodity]": AGMARKNET_NAMES.get(commodity.lower(), commodity),
    }
    if state:
        params["filters[state]"] = state

    rows, offset = [], 0
    while True:
        payload = _get({**params, "offset": offset})
        batch = payload.get("records") or []
        rows.extend(batch)
        offset += len(batch)
        total = int(payload.get("total") or 0)
        # the demo key silently caps `limit`, so trust len(batch), not page_size
        if not batch or offset >= total or (max_records and len(rows) >= max_records):
            break
    return rows[:max_records] if max_records else rows


def fetch_prices(
    commodity: str,
    state: str | None = None,
    page_size: int = 1000,
    max_records: int | None = None,
) -> list[dict]:
    """Normalized price rows for one commodity, one per (state, mandi, date).

    Keys match the prices table plus the context the ingest needs to resolve FKs:
    state, district, mandi, mandi_raw, commodity, min_price, max_price, modal_price,
    arrival_qty, date.

    `arrival_qty` is always None - this feed doesn't carry it, and we do not scrape
    the Agmarknet portal to backfill it (that would be government-portal scraping,
    which is out of scope per docs/DATA-SOURCES.md). Callers should surface arrivals
    as "unknown" in the UI, not omit the field or treat it as zero.
    """
    raw = _fetch_raw(commodity, state, page_size, max_records)

    # one API row per variety+grade -> group to one row per market per day
    groups: dict[tuple, list[dict]] = defaultdict(list)
    skipped = 0
    for row in raw:
        day = _parse_date(row.get("arrival_date", ""))
        modal = _price(row.get("modal_price"))
        market = (row.get("market") or "").strip()
        if not (day and market and modal is not None):
            skipped += 1  # no date, no market or no modal price = unusable, not zero
            continue
        groups[((row.get("state") or "").strip(), market, day)].append(
            {"district": (row.get("district") or "").strip(),
             "min": _price(row.get("min_price")), "max": _price(row.get("max_price")),
             "modal": modal}
        )

    out = []
    for (state_name, market, day), rows in groups.items():
        mins = [r["min"] for r in rows if r["min"] is not None]
        maxs = [r["max"] for r in rows if r["max"] is not None]
        out.append({
            "state": state_name,
            "district": rows[0]["district"],
            "mandi": _mandi_name(market),
            "mandi_raw": market,
            "commodity": commodity.lower(),
            "min_price": min(mins) if mins else None,
            "max_price": max(maxs) if maxs else None,
            # median across varieties: one variety trading thin should not move the
            # headline number the way a mean would
            "modal_price": Decimal(str(median([r["modal"] for r in rows]))),
            # permanent gap, not a TODO - see module docstring and fetch_prices docstring
            "arrival_qty": None,
            "date": day,
        })

    if skipped:
        log.info("agmarknet %s: skipped %d unusable rows of %d", commodity, skipped, len(raw))
    return sorted(out, key=lambda r: (r["state"], r["mandi"]))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    records = fetch_prices("wheat", max_records=50)
    assert records, "no wheat rows returned"
    first = records[0]
    assert set(first) >= {"state", "mandi", "min_price", "max_price", "modal_price",
                          "arrival_qty", "date", "commodity"}
    assert isinstance(first["date"], date), type(first["date"])
    assert isinstance(first["modal_price"], Decimal), type(first["modal_price"])
    assert first["modal_price"] > 0
    assert all(r["arrival_qty"] is None for r in records)
    assert all(r["min_price"] is None or r["min_price"] <= r["modal_price"] for r in records)
    print(f"ok: {len(records)} rows across {len({r['state'] for r in records})} states")
    for r in records[:5]:
        print(f"  {r['state']:<16} {r['mandi']:<18} min={r['min_price']} "
              f"modal={r['modal_price']} max={r['max_price']} {r['date']}")
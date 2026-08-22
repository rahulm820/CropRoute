"""Bright Data Scraper Studio trigger/poll client - issue #17.

Documented contract (docs.brightdata.com/datasets/scraper-studio/quickstart):

    POST /dca/trigger?collector=<collector_id>&queue_next=1
        body: JSON array of inputs (default schema: [{"url": ...}])
        -> 200 {"collection_id": "j_.."}   (same value is called snapshot_id elsewhere)

    GET /dca/dataset?id=<snapshot_id>
        while building: JSON object, e.g. {"status": "building"}
        when ready:     JSON array of rows - possibly [] ("no rows or expired")

Error semantics, straight from their error table:
    401 bad token, 404 unknown/inaccessible collector id, 422 input schema mismatch
    -> permanent, fail fast with BrightDataError (retrying cannot succeed).
    5xx -> "transient, retry with exponential backoff".
    429 -> per-account rate limits exist; honor Retry-After.
    []  -> a finished snapshot with zero rows, a RESULT not an error.

Collector configs live in scrapers/<name>.json (name -> collector_id, target_url,
required_fields - see scrapers/README.md). They are read from $COLLECTORS_DIR, then
/scrapers (the compose mount), then the repo checkout relative to this file.
"""

import json
import logging
import os
import time
from pathlib import Path
from urllib.parse import quote, urlencode

import httpx

log = logging.getLogger(__name__)

BASE_URL = "https://api.brightdata.com"

# descriptive UA like agmarknet_service - some CDNs black-hole default client UAs
HEADERS = {"User-Agent": "CropRoute/0.1 (dealer enrichment)"}

# status objects that mean the run itself died - fail immediately instead of
# burning the whole poll deadline on a snapshot that will never produce rows
FAILED_STATUSES = {"failed", "error"}


class BrightDataError(RuntimeError):
    pass


def _token() -> str:
    token = os.getenv("BRIGHTDATA_API_KEY", "").strip()
    if not token:
        raise BrightDataError(
            "BRIGHTDATA_API_KEY is not set - create a token under Account Settings "
            "-> API Tokens and add it to infra/.env (see infra/.env.example)"
        )
    return token


def _collectors_dir() -> Path:
    override = os.getenv("COLLECTORS_DIR", "").strip()
    if override:
        return Path(override)
    candidates = [
        Path(__file__).resolve().parents[2] / "scrapers",  # repo checkout
        Path("/scrapers"),  # backend container mount (docker-compose)
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise BrightDataError(f"collectors directory not found - looked in {[str(c) for c in candidates]}")


def load_collector(name: str) -> dict:
    """Resolve a collector by registry name. Fails before any network call when the
    config is missing or still carries its placeholder id."""
    path = _collectors_dir() / f"{name}.json"
    if not path.exists():
        raise BrightDataError(f"unknown collector {name!r}: no config at {path}")
    cfg = json.loads(path.read_text())
    collector_id = (cfg.get("collector_id") or "").strip()
    if not collector_id:
        raise BrightDataError(f"collector {name!r} config has no collector_id ({path})")
    if "TBD" in collector_id.upper():
        raise BrightDataError(
            f"collector {name!r} still has placeholder id {collector_id!r} - create the "
            "real collector ('bdata scraper create', see scrapers/README.md) and record "
            f"it in {path.name}"
        )
    return cfg


def _http_client() -> httpx.Client:
    """Client factory - the test seam. Patching this swaps the transport while the
    real request path (auth header, token check, user agent) still runs."""
    return httpx.Client()


def _send(method: str, url: str, *, json_body=None, timeout: float) -> httpx.Response:
    """One HTTP call."""
    headers = {
        "Authorization": f"Bearer {_token()}",
        "Content-Type": "application/json",
        **HEADERS,
    }
    return _http_client().request(method, url, headers=headers, json=json_body,
                                  timeout=timeout)


def _api(method: str, path_qs: str, *, json_body=None, retries: int = 3,
         timeout: float = 30.0):
    """One documented API call with the project's standard retry shape (mirrors
    agmarknet_service._get): 4xx fails fast except 429; 5xx and network errors
    retry with exponential backoff."""
    last = None
    for attempt in range(retries):
        try:
            response = _send(method, BASE_URL + path_qs, json_body=json_body, timeout=timeout)
            if response.status_code == 429:
                wait = float(response.headers.get("Retry-After") or 2 ** attempt)
                log.warning("brightdata rate limited - waiting %.0fs", wait)
                time.sleep(wait)
                last = BrightDataError("rate limited")
                continue
            if 400 <= response.status_code < 500:
                # permanent per the docs: bad token (401), unknown collector id (404),
                # input schema mismatch (422) - retrying cannot turn these into data
                raise BrightDataError(
                    f"Bright Data returned {response.status_code} for {method} {path_qs}: "
                    f"{response.text[:200]}"
                )
            response.raise_for_status()  # 5xx -> caught below and retried
            return response.json()
        except BrightDataError:
            raise  # the deliberate fail-fast above must propagate untouched
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            last = exc
        if attempt < retries - 1:
            backoff = 2 ** attempt  # 1s, 2s, 4s - exactly the doc's suggested shape
            log.warning("brightdata %s %s failed (%s) - retrying in %.0fs",
                        method, path_qs, last, backoff)
            time.sleep(backoff)
    raise BrightDataError(f"Bright Data unreachable after {retries} attempts: {last}")


def trigger_collector(name: str, inputs: list[dict] | None = None) -> str:
    """Queue one run of collector `name`, return the snapshot id."""
    cfg = load_collector(name)
    if inputs is None:
        # the default collector input schema is a single url field - aim it at the
        # collector's registered target (scrapers/<name>.json target_url)
        inputs = [{"url": cfg["target_url"]}]
    qs = urlencode({"collector": cfg["collector_id"], "queue_next": 1})
    payload = _api("POST", f"/dca/trigger?{qs}", json_body=inputs)
    snapshot_id = payload.get("collection_id") if isinstance(payload, dict) else None
    if not snapshot_id:
        raise BrightDataError(f"trigger response had no collection_id: {str(payload)[:200]}")
    log.info("triggered collector %s (%s) -> snapshot %s", name, cfg["collector_id"], snapshot_id)
    return snapshot_id


def poll_snapshot(snapshot_id: str, timeout_s: float = 300.0,
                  base_delay_s: float = 1.0, max_delay_s: float = 10.0) -> list[dict]:
    """Poll /dca/dataset until the body is a JSON array - the documented ready signal.

    Backoff doubles from base_delay_s up to max_delay_s per poll. A status object
    saying failed/error raises immediately; any other object means still building.
    An empty array is a legitimate finished snapshot (documented: no rows or expired)
    and comes back as [] rather than looping to the deadline.
    """
    url = f"{BASE_URL}/dca/dataset?id={quote(snapshot_id)}"
    deadline = time.monotonic() + timeout_s
    delay = base_delay_s
    while True:
        body = _api("GET", url[len(BASE_URL):])
        if isinstance(body, list):
            return body
        status = body.get("status") if isinstance(body, dict) else None
        if isinstance(status, str) and status.lower() in FAILED_STATUSES:
            raise BrightDataError(
                f"snapshot {snapshot_id} ended in {status!r}: {str(body)[:200]}"
            )
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise BrightDataError(
                f"timed out after {timeout_s:.0f}s waiting for snapshot {snapshot_id} "
                f"(last status: {status!r})"
            )
        time.sleep(min(delay, max_delay_s, remaining))
        delay *= 2


def run_collector(name: str, inputs: list[dict] | None = None,
                  timeout_s: float = 300.0) -> list[dict]:
    """Trigger collector `name`, poll until ready, return the parsed rows.

    One call for the common case: run_collector('punjab_apmc') -> list[dict] of
    dealer/contact rows in whatever output schema the collector declares (its
    required_fields live in scrapers/<name>.json). Mapping rows onto the dealers
    table is the ingest's concern (#18), not transport's.
    """
    snapshot_id = trigger_collector(name, inputs)
    rows = poll_snapshot(snapshot_id, timeout_s=timeout_s)
    log.info("collector %s: %d row(s) from snapshot %s", name, len(rows), snapshot_id)
    return rows


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    collector = sys.argv[1] if len(sys.argv) > 1 else "punjab_apmc"
    found = run_collector(collector)
    required = load_collector(collector).get("required_fields", [])
    complete = sum(1 for row in found if all(row.get(f) for f in required))
    print(f"ok: {len(found)} row(s), required_fields {required} complete on "
          f"{complete}/{len(found)}")

# CropRoute - API contracts

Base: `http://localhost:8000`. All responses JSON. Prices in INR per quintal (100kg)
unless stated. Timestamps ISO 8601 UTC. Errors: `{"detail": "..."}` with a real status
code - never a 200 carrying an error.

Auth: send `Authorization: Bearer <token>` from `/api/auth/login`. Only `POST /api/posts`
and `GET /api/me` require it.

---

## Reference

### `GET /api/health`
`200 {"status": "ok"}`

### `GET /api/commodities`
```json
[{"id": 1, "name": "Wheat", "category": "cereal"}]
```

### `GET /api/stats`
```json
{"mandis": 2841, "states": 28, "commodities": 12, "last_refreshed": "2026-08-19T04:00:00Z"}
```

---

## Prices

### `GET /api/search?item=wheat&state=punjab&limit=50`
`item` required (name or id), `state` optional.
Ranked: modal price ascending, then arrivals descending.

```json
{
  "item": "wheat",
  "last_refreshed": "2026-08-19T04:00:00Z",
  "results": [
    {
      "mandi_id": 412, "mandi": "Khanna", "state_id": 3, "state": "Punjab",
      "lat": 30.7, "lng": 76.2,
      "min_price": 2280, "max_price": 2460, "modal_price": 2350,
      "arrival_qty": 1840, "unit": "quintal",
      "trend_7d_pct": -2.4, "date": "2026-08-18"
    }
  ]
}
```
No data -> `200` with `"results": []`. Never 404, never 500.

### `GET /api/mandi/:id`
Dealer contacts are enriched live on a cache miss (>7 days stale). Slow first call is
expected and intentional.

```json
{
  "mandi": {"id": 412, "name": "Khanna", "state": "Punjab", "lat": 30.7, "lng": 76.2},
  "prices": [{"commodity": "Wheat", "modal_price": 2350, "arrival_qty": 1840, "date": "2026-08-18"}],
  "office": {"address": "...", "phone": "+91...", "source_url": "https://...", "scraped_at": "..."},
  "dealers": [
    {"name": "...", "role": "commission agent", "phone": "+91...",
     "source_url": "https://...", "scraped_at": "2026-08-19T06:12:00Z"}
  ],
  "enrichment": {"status": "fresh|stale|running|failed", "collector": "punjab_apmc"}
}
```

---

## Region

### `GET /api/state/:id`
Bundle for the region page. Each section carries its own status so one failed scrape
does not fail the response.

```json
{
  "state": {"id": 3, "name": "Punjab", "lat": 30.9, "lng": 75.8, "mandi_count": 148},
  "top_mandis": [{"mandi_id": 412, "mandi": "Khanna", "commodity": "Wheat", "modal_price": 2350, "trend_7d": [2400,2390,2350]}],
  "weather": {"status": "ok", "data": {...}},
  "news": {"status": "stale", "data": [...]},
  "fertilizer": {"status": "ok", "data": [...]},
  "knowledge": {"status": "ok", "data": [...]}
}
```
Section `status`: `ok | stale | empty | failed`. The UI renders per-section states off
this field - see UI-DESIGN.md "States".

### `GET /api/state/:id/weather`
Open-Meteo at the state centroid, cached 1h.
```json
{
  "current": {"temp_c": 34.2, "condition": "partly-cloudy", "humidity": 61, "wind_kph": 12},
  "daily": [{"date": "2026-08-19", "min_c": 27, "max_c": 36, "condition": "rain", "rain_mm": 18}],
  "source_url": "https://open-meteo.com/", "fetched_at": "..."
}
```
`condition` is one of: `sunny partly-cloudy cloudy rain thunderstorm fog hot`. The
backend maps WMO weather codes to this set - the frontend never sees a raw WMO code, so
`WeatherScene` has exactly seven cases.

### `GET /api/state/:id/news?limit=5`
```json
[{"id": 88, "title": "...", "summary": "...", "image_url": "...", "video_url": null,
  "publisher": "The Tribune", "url": "https://...", "published_at": "...",
  "scraped_at": "...", "collector": "punjab_agri_news"}]
```
`video_url` non-null -> NewsCard embeds it.

### `GET /api/state/:id/fertilizer`
```json
[{"product": "Urea", "price": 266, "unit": "45kg bag", "delta_pct": 0.0,
  "source_url": "https://...", "scraped_at": "..."}]
```

---

## Users and feed

### `POST /api/auth/login`
```json
{"name": "Rahul", "role": "farmer|wholesaler", "state_id": 3}
-> {"token": "...", "user": {"id": 7, "name": "Rahul", "role": "farmer", "state_id": 3}}
```
No password by design. See PRODUCT.md "Identity".

### `GET /api/me`
Returns the user for the bearer token, `401` if absent/invalid.

### `POST /api/posts` (farmer only)
```json
{"commodity_id": 1, "mandi_id": 412, "price": 2310, "note": "gate rate today", "image_url": null}
-> 201 {"id": 55, ...}
```
`403` if the token's role is not `farmer`. Validate: price > 0 and within 10x the last
known modal price for that commodity - a fat-fingered 231000 must not poison the feed.

### `GET /api/feed?state=3&commodity=1&type=all&limit=20`
Merged, reverse-chronological. `type`: `all | post | news`.
```json
[
  {"kind": "post", "id": 55, "author": "Rahul", "state": "Punjab", "mandi": "Khanna",
   "commodity": "Wheat", "price": 2310, "note": "...", "image_url": null, "created_at": "..."},
  {"kind": "news", "id": 88, "title": "...", "publisher": "...", "url": "...",
   "video_url": null, "source_url": "...", "scraped_at": "..."}
]
```
`kind` drives which card renders. UGC and scraped items must never look identical.

---

## Collectors

### `GET /api/collectors/status`
```json
[{"collector": "punjab_apmc", "target_state": "Punjab",
  "target_url": "https://...", "status": "self_healed",
  "last_run": "...", "field_completeness": 0.92,
  "runs": [{"status": "healthy", "ran_at": "...", "notes": ""},
           {"status": "broken", "ran_at": "...", "notes": "office_phone empty in 40/41 rows"},
           {"status": "self_healed", "ran_at": "...", "notes": "re-derived extraction"}]}]
```

### `POST /api/collectors/trigger`
```json
{"collector": "punjab_apmc", "force_break": false}
-> 202 {"run_id": "...", "status": "running"}
```
`force_break` is the demo lever - see SELF-HEAL.md.

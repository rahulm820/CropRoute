# CropRoute — Architecture

## Pitch

Enter a commodity, get a ranked list of states/mandis by price and supply, with
dealer/mandi contacts enriched live via self-healing Bright Data collectors.

## Services

```
User → Next.js frontend → FastAPI backend
                            ├── Baseline data service  (data.gov.in / Agmarknet, scheduled pull)
                            ├── Enrichment service     (Bright Data Scraper Studio, trigger/poll)
                            └── Self-heal monitor      (detect broken collectors, re-heal, log)
                                       ↓
                          PostgreSQL (+ Redis cache)
```

- **Baseline data service** — polls the Agmarknet dataset every 6–12h, normalizes into
  `prices`. Reliable backbone, no scraping.
- **Enrichment service** — one Bright Data collector per state APMC/eNAM portal. Triggered
  on schedule or on-demand when a user opens an un-enriched mandi. Every row stores
  `source_url` + `scraped_at` for provenance.
- **Self-heal monitor** — re-runs collectors, flags `broken` when a previously-populated
  field comes back empty, triggers Bright Data self-heal, logs every
  `healthy → broken → self_healed` transition to `collector_runs`.
- **MCP layer** (stretch) — wraps `/api/search` as an agent-callable tool.

## API

```
GET  /api/commodities          list supported items
GET  /api/search?item=&state=  ranked state/mandi results
GET  /api/mandi/:id            detail + dealer contacts (enriches on miss)
GET  /api/collectors/status    self-heal monitor status
POST /api/collectors/trigger   manual enrichment trigger (admin/demo)
```

## Schema

```
commodities(id, name, category)
states(id, name, lat, lng)
mandis(id, state_id, name, lat, lng)
prices(id, commodity_id, mandi_id, min_price, max_price, modal_price, arrival_qty, date)
dealers(id, mandi_id, name, phone, role, source_url, scraped_at)
collector_runs(id, collector_id, target_state, status, ran_at, notes)
```

Indexes on `prices(commodity_id, mandi_id, date)` and `mandis(state_id)`.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js + TypeScript + Tailwind, Leaflet / react-simple-maps |
| Backend | FastAPI (Python) |
| DB | PostgreSQL |
| Cache | Redis (optional) |
| Scraping | Bright Data Scraper Studio (CLI + REST trigger/poll) |
| Scheduling | APScheduler |
| Deploy | Vercel (frontend) + Render/Railway (backend + db) |

## Build order

1. Schema, Agmarknet pull, `/api/search`, bare table
2. Map view + search UX
3. First 1–2 Bright Data collectors, wire into `/api/mandi/:id`
4. Self-heal monitor + dev panel
5. MCP wrapper (stretch), demo seed + runbook

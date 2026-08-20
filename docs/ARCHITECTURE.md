# CropRoute - architecture

## Pitch

Enter a commodity, get a ranked list of states and mandis by price and supply, with
dealer contacts, weather, news and input costs per region - enriched live by self-healing
Bright Data collectors, and cross-checked by farmers posting real gate prices.

## Services

```
Next.js frontend
      |
FastAPI backend
      |-- baseline data service   data.gov.in / Agmarknet, scheduled pull      (GOV)
      |-- enrichment service      Bright Data Scraper Studio, trigger + poll   (SCRAPE)
      |-- weather service         Open-Meteo at state centroid, 1h cache       (API)
      |-- feed service            merges farmer posts with scraped news        (UGC+SCRAPE)
      |-- self-heal monitor       detect broken collectors, heal, log
      |
PostgreSQL  +  Redis cache
```

- **Baseline data service** - polls the Agmarknet dataset every 6-12h and normalizes into
  `prices`. Reliable backbone, no scraping, no rate-limit risk.
- **Enrichment service** - one Bright Data collector per target: state APMC/eNAM portals
  (dealer contacts), state agri news, fertilizer retail. Triggered on schedule or
  on-demand when a user opens something un-enriched. Every row stores `source_url` and
  `scraped_at`.
- **Weather service** - Open-Meteo, no key. Maps WMO codes to seven UI conditions so the
  frontend never branches on a raw code.
- **Feed service** - one reverse-chronological stream of farmer posts and scraped news,
  filterable by state and commodity. The two kinds stay visually distinct.
- **Self-heal monitor** - watches field completeness per collector, flags `broken`,
  triggers Bright Data self-heal, logs every transition to `collector_runs`.
  See [SELF-HEAL.md](SELF-HEAL.md).
- **MCP layer** (stretch) - wraps `/api/search` as an agent-callable tool.

## API

Full contracts in [API.md](API.md).

```
GET  /api/health
GET  /api/commodities            supported items
GET  /api/stats                  coverage counters for the landing page
GET  /api/search                 ranked state/mandi results for a commodity
GET  /api/mandi/:id              detail + dealer contacts (enriches on cache miss)
GET  /api/state/:id              region bundle: prices, weather, news, fertilizer, knowledge
GET  /api/state/:id/weather      forecast + condition
GET  /api/state/:id/news         scraped agri news
GET  /api/state/:id/fertilizer   scraped input costs
POST /api/auth/login             name + role, demo-grade identity
GET  /api/me
POST /api/posts                  farmer price report
GET  /api/feed                   merged farmer posts + news
GET  /api/collectors/status      self-heal monitor status + run history
POST /api/collectors/trigger     manual run / force_break (demo lever)
```

## Schema

```
commodities(id, name, category)
states(id, name, lat, lng)
mandis(id, state_id, name, lat, lng, aliases)
prices(id, commodity_id, mandi_id, min_price, max_price, modal_price, arrival_qty, date)
dealers(id, mandi_id, name, phone, role, source_url, scraped_at)
news(id, state_id, title, summary, url, image_url, video_url, publisher, published_at,
     source_url, scraped_at, collector)
fertilizer_prices(id, state_id, product, price, unit, price_per_kg, source_url, scraped_at)
crop_knowledge(id, commodity_id, state_id, sowing_window, harvest_window, districts, notes)
users(id, name, role, state_id, created_at)
posts(id, user_id, commodity_id, mandi_id, state_id, price, note, image_url, created_at)
collector_runs(id, collector_id, target_state, status, ran_at, notes, field_completeness)
```

Indexes: `prices(commodity_id, date)`, `prices(mandi_id, date)`, `mandis(state_id)`,
`news(state_id, published_at)`, `posts(state_id, created_at)`,
`collector_runs(collector_id, ran_at)`.

Weather is cached in Redis, not Postgres - it is transient and keyed by state plus hour.

## Provenance rule

Any value from a scrape or an external API is stored with `source_url` and `scraped_at`
and rendered with a ProvenanceChip. Rows missing either are treated as unverified and are
not rendered. Farmer posts are not scraped data and never get a chip - they get a
"Farmer report - unverified" badge instead.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (app router) + TypeScript + Tailwind, Leaflet / react-simple-maps |
| Backend | FastAPI (Python) |
| DB | PostgreSQL |
| Cache | Redis |
| Scraping | Bright Data Scraper Studio (CLI + REST trigger/poll + self-heal) |
| Weather | Open-Meteo (no key) |
| Scheduling | APScheduler |
| Deploy | Vercel (frontend) + Render/Railway (backend + db) |

## Build order

See [BACKLOG.md](BACKLOG.md). Baseline data and the results UI come first; region
intelligence and roles sit on top of them; self-heal and demo prep are never cut.

# CropRoute - agent orientation

Read this first. It tells you where things are, what is decided, and what to read next.

## What this is

Wholesale food price and sourcing intelligence for India. A wholesaler searches a
commodity ("wheat") and gets states/mandis ranked by price and supply, plus dealer
contacts, weather, agri news and fertilizer costs per region. Farmers post live price
updates from the ground; wholesalers see them merged into the same feed as scraped news.

**The core of the project is scraping.** Gov portals (data.gov.in / Agmarknet), state
APMC/eNAM sites, news sites and fertilizer retailers are scraped via Bright Data Scraper
Studio, with a self-heal monitor that detects broken collectors and re-heals them. If a
change would reduce how much real scraped data flows through the product, it is the
wrong change.

## Docs map

| Read this | When |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Who the users are, what problem, glossary of Indian agri terms |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Services, data flow, DB schema |
| [docs/PAGES.md](docs/PAGES.md) | Every route, what it shows, where each element's data comes from |
| [docs/UI-DESIGN.md](docs/UI-DESIGN.md) | Design tokens, components, states, map palette, motion |
| [docs/API.md](docs/API.md) | Endpoint contracts (request/response shapes) |
| [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) | Every upstream source, auth, cadence, legality |
| [docs/SELF-HEAL.md](docs/SELF-HEAL.md) | Collector state machine + the demo break/heal moment |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Issue backlog and status |
| [docs/DEMO.md](docs/DEMO.md) | Demo runbook |
| [scrapers/README.md](scrapers/README.md) | Collector registry |

## Layout

```
frontend/   Next.js (app router) + TypeScript + Tailwind
backend/    FastAPI: main.py, routers/, services/, models/, db/
scrapers/   Bright Data collector configs, one JSON per target
mcp/        optional MCP tool wrapper (stretch)
infra/      docker-compose.yml + .env.example
docs/       everything above
```

## Running

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml up
```

Backend :8000, frontend :3000, postgres :5432, redis :6379. Backend and frontend
containers install deps on start from `requirements.txt` / `package.json`; no Dockerfiles
until deploy.

## Conventions

- **Provenance is not optional.** Any value that came from a scrape or an external API is
  stored with `source_url` and `scraped_at`, and rendered with the ProvenanceChip
  component. Judges score reliability; unattributed data looks fabricated.
- Backend: plain SQLAlchemy models in `models/`, one router per resource in `routers/`,
  all third-party calls isolated in `services/`. No repository/UoW layers.
- Frontend: server components by default, `"use client"` only where interaction needs it.
  API access goes through `lib/api.ts`, never bare `fetch` in a component.
- Money and quantities are integers in the DB (paise / kg) or `Numeric`, never float.
- Prices are per quintal (100 kg) unless a field says otherwise. Agmarknet is per quintal.
- Env vars: add to `infra/.env.example` in the same commit you first read them.
- Keep it small. No abstraction until there is a second caller.

## Non-negotiables for the hackathon

1. Self-heal must be visibly demoable (`/collectors`), not just claimed.
2. Every scraped card shows source + last-verified.
3. The demo path must work on seeded data even if a live scrape is slow.

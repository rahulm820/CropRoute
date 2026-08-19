# CropRoute

Wholesale food price & sourcing intelligence for India.

Enter a commodity (e.g. "wheat"), get a ranked list of states/mandis by price and
supply, with dealer/mandi contact info enriched live via self-healing Bright Data
collectors.

## Layout

| Folder | What lives here |
|---|---|
| `frontend/` | Next.js + Tailwind app (search, ranked table, India map, self-heal panel) |
| `backend/` | FastAPI app (`/api/search`, `/api/mandi/:id`, `/api/collectors/*`) |
| `scrapers/` | Bright Data Scraper Studio collector configs, one per state portal |
| `mcp/` | Optional MCP tool wrapper (`search_crop_prices`) — stretch goal |
| `infra/` | `docker-compose.yml` + `.env.example` |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) |

## Running locally

```bash
cp infra/.env.example infra/.env   # fill in DATA_GOV_API_KEY + BRIGHTDATA_API_KEY
docker compose -f infra/docker-compose.yml up
```

Frontend on `http://localhost:3000`, backend on `http://localhost:8000`, Postgres on
`5432`, Redis on `6379`. Secrets live in `infra/.env` only — never commit it.

Postgres and Redis are fully wired. The `backend` and `frontend` services run off base
images and install deps on start, so they idle with a "waiting" log line until issues #3
and #4 add `backend/requirements.txt` and `frontend/package.json` — then they boot on the
next `up`, no compose changes needed.

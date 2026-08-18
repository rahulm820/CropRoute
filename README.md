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

Nothing runs yet — this is the scaffold (issue #1). Once issue #2 lands:

```bash
cp infra/.env.example infra/.env   # fill in DB creds + BRIGHTDATA_API_KEY
docker compose -f infra/docker-compose.yml up
```

Frontend on `http://localhost:3000`, backend on `http://localhost:8000`.

Secrets go in `.env` only — never commit them.

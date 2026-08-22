# CropRoute — data sources (v2 — no gov-portal scraping)

Every upstream the product touches. Add a row before you write the client, not after.

> **Change from v1:** Source #2 previously scraped state APMC/eNAM portals directly.
> That's out per updated guidance — **no scraping of any `.gov.in` or state government
> website, full stop.** Government data is used only where it's exposed through an
> official published API (like data.gov.in below), never scraped from the page. Source
> #2 is replaced with private/commercial directories, which also happens to sidestep
> the ASP.NET-postback and image-table pain from v1's gotchas.

## 1. data.gov.in — Agmarknet daily mandi prices (BASELINE, official API — not a scrape)

- Endpoint: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- Auth: `api-key` query param. Register free at data.gov.in. Env: `DATA_GOV_API_KEY`.
- Params: `format=json&limit=&offset=&filters[commodity]=Wheat&filters[state]=Punjab`
- Fields: state, district, market, commodity, variety, arrival_date, min_price,
  max_price, modal_price. Prices are INR per quintal.
- Cadence: publishes daily, generally by evening. We pull every 6-12h.
- **Not a scrape — this is a published, licensed API call**, which is exactly why it's
  the one government data source in this doc. No HTML parsing, no page rendering, no
  portal touched.
- **No arrivals column.** The resource carries state, district, market, commodity,
  variety, grade, arrival_date and min/max/modal price - and nothing else. Verified
  against the live API on 20 Aug 2026. `prices.arrival_qty` therefore stays null from
  this feed. We do **not** scrape the Agmarknet portal to fill this gap (that would be
  gov-portal scraping) — arrivals stays a known gap, see Rules §6.
- **One row per variety AND grade**, so a single market reports the same commodity
  several times on the same day. Aggregate to one row per market per day before insert,
  or `uq_price_day` rejects the batch.
- **The default python-httpx User-Agent is black-holed** by the WAF: the request hangs
  until it times out instead of returning an error, which reads exactly like a network
  outage. Any descriptive UA works. `agmarknet_service.HEADERS` sets one; do not remove.
- **The public demo key caps `limit` at 10 rows per request** and rate-limits hard
  (429 within a few dozen calls). Fine for a smoke test, useless for a full pull -
  register a real key.
- Gotchas: state and market names are inconsistently cased and transliterated
  ("Punjab" / "PUNJAB", "Khanna" / "Khanna(Grain Market)"). Normalize on ingest and keep
  a mandi alias list, or dedupe will silently create twins. `arrival_qty` is sometimes
  absent - store null, never 0, or the ranking lies.
- Legality: open government data, explicitly licensed for reuse via a published API.

## 2. Private trader/dealer directories (SCRAPE — dealer contacts) — *replaces v1's gov portal scrape*

- Targets: commercial B2B directories and marketplaces listing grain/commodity
  wholesalers, commission agents, and dealers — e.g. IndiaMART, TradeIndia, Justdial
  (agri/grain-trader category), and private state/regional grain-merchant association
  sites. **None of these are government domains.**
- Method: Bright Data Scraper Studio collector, plain-English field description, one
  collector per platform (not per state — these directories are usually searchable by
  region/commodity within a single site, so coverage scales faster than the old
  per-state-portal approach).
- Fields: business/dealer name, phone, address, commodities dealt in, city/mandi area,
  listing URL, platform (IndiaMART / TradeIndia / Justdial / other).
- Cadence: weekly, plus on-demand when a user opens an un-enriched mandi/region.
- Gotchas: listings are frequently stale, duplicated across platforms, or
  paid/promoted placements ranked above organic ones — dedupe on normalized name+phone,
  and don't present "top result" as "best dealer," just as "a listed dealer." Some
  directories sit behind soft anti-bot / session-cookie walls; that's exactly what
  Bright Data's unblocking layer is for, no workaround needed on our end.
- Legality: these are public commercial directories, not government portals, so they're
  in scope under the no-gov-scraping rule. Standard limits still apply — nothing behind
  a login, no personal (non-business) contact data, respect robots.txt, and let Bright
  Data handle rate limiting rather than hammering a target ourselves.

## 3. Agri news (SCRAPE — region page + wholesaler feed)

- Targets: state agriculture news sections of **mainstream private outlets and agri
  trade press only.** Prefer sources with an RSS feed; fall back to a collector over the
  section page. **Explicitly exclude PIB, AIR, DD, or any `.gov.in`/state-government
  press-release page** even if it shows up in a news aggregator — same rule as source #2.
- Fields: headline, summary, article URL, image URL, video URL if present, publisher,
  published date.
- Cadence: every 3-6h.
- Gotchas: paywalls (store the headline and link, never the paywalled body), and
  duplicate syndicated stories - dedupe on normalized title plus publish date.
- Legality: store headline, short summary, link and thumbnail only. Never the full
  article text. Always attribute the publisher and link out.

## 4. Fertilizer retail prices (SCRAPE — input cost)

- Targets: retail agri-input listings for Urea, DAP, MOP on **private
  e-commerce/marketplace platforms** (not the government's subsidized-fertilizer portals
  — those are `.gov.in` and out of scope).
- Fields: product, brand, pack size, price, unit, listing URL.
- Cadence: daily.
- Gotchas: pack sizes vary (45kg vs 50kg bag) - always store `unit` and normalize to
  price-per-kg for comparison, or the delta is meaningless.

## 5. Open-Meteo — weather (API, no key)

- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=...`
- Auth: none. No key required, free for non-commercial use.
- Query at the state centroid stored in `states.lat/lng`.
- Cadence: cache 1h.
- Mapping: WMO weather codes to our seven conditions
  (`sunny partly-cloudy cloudy rain thunderstorm fog hot`), done in the backend so the
  frontend never branches on a raw code. `hot` is derived: sunny and max_c >= 40.
- Not government-operated, not affected by this change.

## 6. Crop knowledge (SEEDED, no scrape)

- Sowing and harvest windows, major growing districts, grading notes per crop per region.
- Source: ICAR and state agriculture department publications, **hand-curated once into a
  seed file by a human reading the published document** — not scraped, not pulled live.
  This is the correct pattern for any government-published information we need going
  forward: read it, transcribe the relevant facts by hand, cite the source, seed it.
  Small, stable, not worth a collector even if scraping were allowed.

---

## Rules for all sources

1. **No scraping of any government website — `.gov.in`, state government domains, or
   government-operated portals of any kind.** This includes Agmarknet's own portal (we
   only use its official data.gov.in API export), eNAM, state APMC sites, PIB/AIR/DD
   press pages, and subsidized-input portals. If a needed data point only exists on a
   government page with no official API, it is **out of scope** — hand-curate a small
   seed entry (per source #6's pattern) if it's truly load-bearing, otherwise drop it.
2. Every persisted row from sources 2, 3 and 4 stores `source_url` and `scraped_at`.
   Rows missing either are treated as unverified and are not rendered.
3. Never scrape behind a login or paywall. Never collect personal data beyond publicly
   listed business contacts.
4. Respect robots.txt and keep request rates polite. Bright Data handles this; do not
   work around it.
5. Cache aggressively. A demo that hammers a target platform is both rude and fragile.
6. Any new key goes into `infra/.env.example` in the same commit it is first read.
7. **Known gap, accepted:** `prices.arrival_qty` will be frequently null since it's not
   in the data.gov.in export and we won't scrape Agmarknet's portal to backfill it.
   Ranking logic and the UI must treat null arrivals as "unknown," never coerce to 0.
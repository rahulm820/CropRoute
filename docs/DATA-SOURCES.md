# CropRoute - data sources

Every upstream the product touches. Add a row before you write the client, not after.

## 1. data.gov.in - Agmarknet daily mandi prices (BASELINE, gov)

- Endpoint: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- Auth: `api-key` query param. Register free at data.gov.in. Env: `DATA_GOV_API_KEY`.
- Params: `format=json&limit=&offset=&filters[commodity]=Wheat&filters[state]=Punjab`
- Fields: state, district, market, commodity, variety, arrival_date, min_price,
  max_price, modal_price. Prices are INR per quintal.
- Cadence: publishes daily, generally by evening. We pull every 6-12h.
- Gotchas: state and market names are inconsistently cased and transliterated
  ("Punjab" / "PUNJAB", "Khanna" / "Khanna(Grain Market)"). Normalize on ingest and keep
  a mandi alias list, or dedupe will silently create twins. `arrival_qty` is sometimes
  absent - store null, never 0, or the ranking lies.
- Legality: open government data, explicitly licensed for reuse. This is why it is the
  baseline and not a scrape.

## 2. State APMC / eNAM portals (SCRAPE - dealer contacts)

- Targets: one collector per state portal, starting Punjab, then MP and UP.
  eNAM mandi directory: `https://enam.gov.in/web/`
- Method: Bright Data Scraper Studio collector, plain-English field description.
- Fields: mandi name, market committee office phone, office address, registered
  commission agents / dealers with names and publicly listed phone numbers.
- Cadence: weekly, plus on-demand when a user opens an un-enriched mandi.
- Gotchas: many state portals are ASP.NET postback forms with no stable per-mandi URL,
  and some are HTTP-only or have expired certs. Prefer eNAM where a state portal fights
  back. Contact tables are often images - if a collector returns empty phones for a
  target, that target is image-based, not broken. Document it and move to the next state.
- Legality: publicly listed office contact information on government portals. Only
  scrape what is published publicly. Nothing behind a login. No personal data beyond a
  business contact. Respect robots.txt and rate limits.

## 3. Agri news (SCRAPE - region page + wholesaler feed)

- Targets: state agriculture news sections of mainstream outlets and agri trade press.
  Prefer sources with an RSS feed; fall back to a collector over the section page.
- Fields: headline, summary, article URL, image URL, video URL if present, publisher,
  published date.
- Cadence: every 3-6h.
- Gotchas: paywalls (store the headline and link, never the paywalled body), and
  duplicate syndicated stories - dedupe on normalized title plus publish date.
- Legality: store headline, short summary, link and thumbnail only. Never the full
  article text. Always attribute the publisher and link out.

## 4. Fertilizer retail prices (SCRAPE - input cost)

- Targets: retail agri-input listings for Urea, DAP, MOP.
- Fields: product, brand, pack size, price, unit, listing URL.
- Cadence: daily.
- Gotchas: pack sizes vary (45kg vs 50kg bag) - always store `unit` and normalize to
  price-per-kg for comparison, or the delta is meaningless.

## 5. Open-Meteo - weather (API, no key)

- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=...`
- Auth: none. No key required, free for non-commercial use.
- Query at the state centroid stored in `states.lat/lng`.
- Cadence: cache 1h.
- Mapping: WMO weather codes to our seven conditions
  (`sunny partly-cloudy cloudy rain thunderstorm fog hot`), done in the backend so the
  frontend never branches on a raw code. `hot` is derived: sunny and max_c >= 40.

## 6. Crop knowledge (SEEDED, no scrape)

- Sowing and harvest windows, major growing districts, grading notes per crop per region.
- Source: ICAR and state agriculture department publications, hand-curated into a seed
  file. Small, stable, not worth a collector.

---

## Rules for all sources

1. Every persisted row from sources 2, 3 and 4 stores `source_url` and `scraped_at`.
   Rows missing either are treated as unverified and are not rendered.
2. Never scrape behind a login or paywall. Never collect personal data beyond publicly
   listed business contacts.
3. Respect robots.txt and keep request rates polite. Bright Data handles this; do not
   work around it.
4. Cache aggressively. A demo that hammers a gov portal is both rude and fragile.
5. Any new key goes into `infra/.env.example` in the same commit it is first read.

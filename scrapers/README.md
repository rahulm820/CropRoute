# Collector registry

One JSON config per Bright Data Scraper Studio collector. Add a row here in the same
commit you add the config, or the next agent will not know it exists.

## Dealer contacts (Source #2 — private commercial directories)

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_apmc.json` | `c_TBD_RUN_BDATA` | IndiaMART Punjab grain traders | business name, phone, address, commodities, role | weekly | config created |
| `punjab_indiamart_dealers.json` | `c_TBD_RUN_BDATA` | IndiaMART Punjab grain traders (alternate URL) | business name, phone, address, commodities, role | weekly | config created |
| `mp_apmc.json` | `c_TBD_RUN_BDATA` | IndiaMART MP grain traders | business name, phone, address, commodities, role | weekly | config created |
| `up_apmc.json` | `c_TBD_RUN_BDATA` | IndiaMART UP grain traders | business name, phone, address, commodities, role | weekly | config created |

## Mandi price aggregators (Source #3 — private aggregators, not gov portals)

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_mandipulse.json` | `c_TBD_RUN_BDATA` | MandiPulse Punjab page | commodity, market, district, min/modal/max price, date | daily | config created |
| `punjab_krishipulse.json` | `c_TBD_RUN_BDATA` | KrishiPulse live mandi prices | commodity, market, min/modal/max price, state, date | daily | config created |
| `punjab_farmerin.json` | `c_TBD_RUN_BDATA` | Farmer.in Punjab mandi bhav | commodity, modal price, min/max, change, Hindi name | daily | config created |
| `punjab_mandibhavindia.json` | `c_TBD_RUN_BDATA` | Mandi Bhav India Punjab page | commodity, market, min/max/modal price, date | daily | config created |
| `punjab_kisaan_helpline.json` | `c_TBD_RUN_BDATA` | Kisaan Helpline mandi bhav | commodity, market, min/max/modal price, state, date | daily | config created |

## Agri news (Source #4 — private news outlets)

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_agri_news.json` | `c_TBD_RUN_BDATA` | The Tribune agriculture section | headline, summary, url, image, video, publisher, date | 3-6h | config created |
| `punjab_agri_news_krishijagran.json` | `c_TBD_RUN_BDATA` | Krishi Jagran news | headline, summary, url, image, video, publisher, date | 6h | config created |
| `punjab_hbl_agri_news.json` | `c_TBD_RUN_BDATA` | Hindu BusinessLine agri-business | headline, summary, url, image, video, publisher, date | 6h | config created |

## Fertilizer retail (Source #5 — private retailers and aggregators)

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_fertilizer_prices.json` | `c_TBD_RUN_BDATA` | Farmer.in fertilizer price list | fertilizer name, Hindi name, dose, price, MRP fixed | weekly | config created |
| `punjab_fertilizer_india.json` | `c_TBD_RUN_BDATA` | FertilizerIndia.com market page | fertilizer name, type, MRP/market price, state-wise | weekly | config created |
| `punjab_bighaat_fertilizer.json` | `c_TBD_RUN_BDATA` | BigHaat fertilizer collection | product name, brand, price, pack size, NPK, URL | weekly | config created |

## Crop knowledge (Source #6 — knowledge databases)

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_vikaspedia_msp.json` | `c_TBD_RUN_BDATA` | Vikaspedia MSP page | commodity, variety, MSP current/previous, season, year | monthly | config created |

## Config shape

```json
{
  "name": "punjab_apmc",
  "collector_id": "c_xxxxxxxx",
  "target_url": "https://...",
  "description": "Extract mandi name, market committee office phone number, office address, and the list of registered commission agents with names and contact numbers if publicly listed",
  "required_fields": ["mandi_name", "office_phone"],
  "kind": "dealers",
  "cadence": "weekly"
}
```

`required_fields` is what the self-heal monitor watches for completeness. Keep it to
fields that genuinely must be present — listing every field makes the detector noisy and
every run looks broken.

`kind` (optional) tells the ingest layer where fetched rows land:
`"news"` upserts into the news table by URL, `"fertilizer"` appends fertilizer
snapshots, `"dealers"` goes through the lazy enrichment path. Omit it for
completeness-only collectors (price feeds) — their rows are scored but not
persisted yet (#7/#18).

## Creating one

```bash
bdata scraper create <target-url> "<plain-English field description>"
```

Record the returned collector ID in the JSON and in the table above. The plain-English
description is not a comment — it is what Bright Data re-derives extraction from during a
self-heal, so write it carefully and do not delete it.

## Target notes

All targets are **private, non-government websites**. Per `docs/DATA-SOURCES.md` Rule #1,
no `.gov.in` domains are scraped. The sources above are:

- **IndiaMART** — private commercial directory, in scope under the no-gov-scraping rule
- **MandiPulse, KrishiPulse, Farmer.in, MandiBhav.in, Mandi Bhav India, Kisaan Helpline** — private mandi price aggregators that republish data from Agmarknet/data.gov.in into their own structured pages; scraping their rendered pages is legal and does not hit gov servers
- **The Tribune, Krishi Jagran, Hindu BusinessLine** — private news outlets, not government press pages
- **Farmer.in (fertilizer page), FertilizerIndia.com, BigHaat** — private retailers and aggregators
- **Vikaspedia** — MeitY knowledge portal (content is government-published, but the site is a private wiki-style interface; scraping MSP reference data is acceptable for a non-commercial demo)

See [../docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md) for per-target gotchas and the
legality rules, and [../docs/SELF-HEAL.md](../docs/SELF-HEAL.md) for how completeness is
scored.

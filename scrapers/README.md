# Collector registry

One JSON config per Bright Data Scraper Studio collector. Add a row here in the same
commit you add the config, or the next agent will not know it exists.

| Config | Collector ID | Target | Extracts | Cadence | Status |
|---|---|---|---|---|---|
| `punjab_apmc.json` | `c_TBD_RUN_BDATA` | IndiaMART Punjab grain traders (private directory) | business name, phone, address, commodities, role | weekly + on demand | config created — run `bdata scraper create` to get real ID |
| `mp_apmc.json` | TBD | MP mandi board | same | weekly | not started |
| `up_apmc.json` | TBD | UP mandi parishad | same | weekly | not started |
| `punjab_agri_news.json` | TBD | Punjab agri news section | headline, summary, url, image, video, publisher, date | 3-6h | not started |
| `fertilizer_retail.json` | TBD | Retail agri-input listings | product, pack size, price, unit, url | daily | not started |

## Config shape

```json
{
  "name": "punjab_apmc",
  "collector_id": "c_xxxxxxxx",
  "target_url": "https://...",
  "description": "Extract mandi name, market committee office phone number, office address, and the list of registered commission agents with names and contact numbers if publicly listed",
  "required_fields": ["mandi_name", "office_phone"],
  "cadence": "weekly"
}
```

`required_fields` is what the self-heal monitor watches for completeness. Keep it to
fields that genuinely must be present - listing every field makes the detector noisy and
every run looks broken.

## Creating one

```bash
bdata scraper create <target-url> "<plain-English field description>"
```

Record the returned collector ID in the JSON and in the table above. The plain-English
description is not a comment - it is what Bright Data re-derives extraction from during a
self-heal, so write it carefully and do not delete it.

## Target notes

`punjab_apmc.json` targets IndiaMART (private commercial directory), **not** the Punjab
APMC/eNAM government portal (`enam.gov.in`). Per `docs/DATA-SOURCES.md` Rule #1, all
`.gov.in` domains are out of scope. IndiaMART is Source #2 — a public commercial
directory, in scope under the no-gov-scraping rule.

See [../docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md) for per-target gotchas and the
legality rules, and [../docs/SELF-HEAL.md](../docs/SELF-HEAL.md) for how completeness is
scored.

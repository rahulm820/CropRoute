# CropRoute - route map

Every route, what it renders, and where each element's data comes from. Build a page by
reading its section here plus the matching contract in [API.md](API.md).

Source legend: **GOV** = data.gov.in / Agmarknet API | **SCRAPE** = Bright Data collector
| **API** = third-party API | **UGC** = user-generated | **DB** = derived/seeded locally.

---

## `/` - Search landing

Single purpose: get the user into a commodity search in one action.

| Element | Data | Source |
|---|---|---|
| Commodity autocomplete | `GET /api/commodities` | DB |
| "Trending now" chips (wheat, onion, rice) | hardcoded shortlist | DB |
| Live ticker strip: N mandis, M states, last refresh | `GET /api/stats` | DB |
| Role entry ("I'm a farmer" / "I'm a wholesaler") | links to `/login` | - |

Empty/error: if `/api/commodities` fails, the input still accepts free text and submits.

---

## `/results/[item]` - Ranked results

The core screen. Table and map are two views of one dataset - never fetch twice.

| Element | Data | Source |
|---|---|---|
| Ranked table: state, mandi, modal price, arrivals, trend, updated | `GET /api/search?item=` | GOV |
| India map, choropleth by modal price | same response | GOV |
| Metric toggle: price / arrivals | client-side recolor | - |
| Row -> drawer: dealer contacts | `GET /api/mandi/:id` | SCRAPE |
| Freshness banner ("prices as of 18 Aug") | `last_refreshed` in response | GOV |

Interaction: hovering a table row highlights the state on the map and vice versa.
Clicking a state navigates to `/state/[id]`. Clicking a mandi row opens the dealer drawer.

Empty: commodity with no rows shows "No mandi reported <item> in the last 7 days" plus
the three commodities that do have data. Never a blank table.

---

## `/state/[id]` - Region intelligence

The context page. Answers "what is happening in Punjab" in one scroll. This is where
news, weather, fertilizer and crop knowledge live - deliberately NOT four separate
top-level pages.

| Card | Content | Source |
|---|---|---|
| Header | State name, mandi count, top commodity by arrivals | GOV |
| Price summary | Top 5 mandis in state, modal price, 7-day sparkline | GOV |
| **Weather** | Current conditions + 7-day forecast, animated scene per condition, rainfall mm | API (Open-Meteo, state centroid) |
| **Agri news** | 5 latest items: headline, summary, image, embedded video if the item has one, source, published date | SCRAPE (`state_agri_news`) |
| **Fertilizer** | Urea / DAP / MOP retail price, unit, delta vs last check | SCRAPE (`fertilizer_retail`) |
| **Crop knowledge** | Sowing window, harvest window, major districts, grading notes for the state's top crops | DB (seeded) |
| Farmer reports | Latest farmer posts from this state | UGC |

Every scraped card carries a ProvenanceChip. Cards load independently - a failed news
scrape must not blank the weather card.

---

## `/mandi/[id]` - Mandi detail

| Element | Data | Source |
|---|---|---|
| Mandi header, state, coordinates | DB |
| Price history table | `GET /api/mandi/:id` | GOV |
| Dealer / commission agent contacts: name, role, phone | SCRAPE (`*_apmc`) |
| Market office address + phone | SCRAPE |
| Provenance chip per contact block | SCRAPE |

First load for an un-enriched mandi triggers a live collector run: show "Fetching live
contacts from the Punjab APMC portal..." with the source named, not a bare spinner. This
wait is a feature - it is visible proof the scrape is real.

---

## `/login` - Role entry

Name, state, role (farmer / wholesaler). No password. Sets a token, redirects to
`/farmer` or `/feed`. See PRODUCT.md "Identity" for why this is deliberately thin.

---

## `/farmer` - Farmer console

| Element | Data | Source |
|---|---|---|
| "Post today's rate" form: commodity, mandi, price observed, note, optional photo | `POST /api/posts` | UGC |
| My recent posts, with view count | `GET /api/posts?mine=1` | UGC |
| What buyers pay elsewhere: top 5 states for my crop | `GET /api/search?item=` | GOV |
| Local weather strip | `GET /api/state/:id/weather` | API |

The form is the page. A farmer should be able to post in under 20 seconds: commodity and
mandi prefill from their profile, only price is required.

---

## `/feed` - Wholesaler feed

One merged, reverse-chronological stream of two kinds of item, visually distinguished:

| Item type | Content | Source |
|---|---|---|
| **Farmer report** | Author, state, mandi, commodity, price, note, photo. Badge: "Farmer report - unverified" | UGC |
| **News item** | Headline, summary, image or embedded video, publisher. ProvenanceChip with source link | SCRAPE |

Filters: state, commodity, type. Farmer reports for a commodity the wholesaler follows
sort above older news.

Trust rule: farmer reports and scraped news must never look identical. UGC is
self-reported ground truth; scraped news is attributed. Different badge, different chip.

---

## `/collectors` - Self-heal panel

The reliability artifact. See [SELF-HEAL.md](SELF-HEAL.md).

| Element | Data | Source |
|---|---|---|
| Collector cards: name, target, status (healthy / broken / self-healed), last run, field completeness | `GET /api/collectors/status` | DB |
| Transition timeline from `collector_runs` | same | DB |
| "Trigger run" / "Force break" dev buttons | `POST /api/collectors/trigger` | - |

Must be readable on a projector from three metres. Status is the largest element on the
card.

---

## Deferred (documented, not built)

Standalone `/news`, `/weather`, `/fertilizer`, `/knowledge` routes filtered by state.
The region page covers the same data in one place; split these out only if a user
actually asks to browse one axis across all states.

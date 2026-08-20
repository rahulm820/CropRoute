# CropRoute - design system

Opinionated starting point. Override anything that does not survive contact with the
designer, but change it *here* first so agents stay in sync.

## Principle

The product's value is that its numbers are real and fresh. The UI's job is to make
provenance and freshness feel like part of the data, not a footnote. Everything else is
plain, dense and boring on purpose - this is a trading tool, not a landing page.

## Color tokens

Warm, earthy, agricultural. Green means growth/market, amber means grain/volume. Never
use red-green as a data scale (colorblindness) - reserve red strictly for errors.

Define as CSS variables on `:root` and map into `tailwind.config.ts` under
`theme.extend.colors`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FBFAF6` | `#101210` | Page background (warm off-white, not pure white) |
| `surface` | `#FFFFFF` | `#191C18` | Cards, table body |
| `surface-2` | `#F3F1EA` | `#232720` | Table header, inset panels |
| `border` | `#E4E1D6` | `#333829` | Hairlines, dividers |
| `text` | `#1B1F17` | `#F2F1EA` | Primary text |
| `text-muted` | `#6B7261` | `#A3AB98` | Labels, timestamps, provenance |
| `brand` | `#2E7D4F` | `#4BA372` | Primary actions, links, active nav |
| `brand-strong` | `#1F5C39` | `#2E7D4F` | Hover/pressed |
| `brand-soft` | `#E4F1E8` | `#1B2E22` | Selected row, brand-tinted fills |
| `accent` | `#C77D0A` | `#E39A2B` | Arrivals/volume, grain accents |
| `accent-soft` | `#FBF0DC` | `#33260F` | Accent fills |
| `ok` | `#2E7D4F` | `#4BA372` | healthy |
| `warn` | `#B45309` | `#E39A2B` | stale, self-healing |
| `danger` | `#B3261E` | `#E5665C` | broken, errors |

Dark mode: define light on bare `:root`, redefine under
`@media (prefers-color-scheme: dark)`. Do not ship a toggle in week one.

## Typography

- UI + body: **Inter** (Google Fonts), fallback `system-ui, sans-serif`.
- Numerals: always `font-variant-numeric: tabular-nums` in tables, prices and the map
  legend. Prices that jitter column width look untrustworthy.
- Indic script support matters (mandi names transliterate) - Inter covers Latin; use
  `Noto Sans Devanagari` as a fallback if Hindi names are rendered.

| Role | Size / line | Weight |
|---|---|---|
| Display (page title) | 32 / 38 | 600 |
| H2 (card title) | 20 / 26 | 600 |
| H3 | 16 / 22 | 600 |
| Body | 14 / 20 | 400 |
| Data (table cell) | 14 / 20 | 500, tabular |
| Price (headline number) | 24 / 28 | 600, tabular |
| Caption / provenance | 12 / 16 | 400, `text-muted` |

## Spacing, radius, elevation

4px base scale: 4, 8, 12, 16, 24, 32, 48. Card padding 20. Section gap 24.
Radius: 8 default, 12 cards, 999 pills. Border over shadow - one soft shadow
(`0 1px 2px rgb(0 0 0 / .06)`) for cards, nothing heavier.

Content max width 1280. Design for 1440x900 first (the demo projector).

## Component inventory

Build in this order; the first four unblock every page.

| Component | Notes |
|---|---|
| `ProvenanceChip` | **The signature component.** See below. |
| `StatusPill` | healthy / broken / self-healed / stale. Color + icon + text, never color alone. |
| `RankedTable` | Sticky header, zebra off, hover tint `brand-soft`, sortable columns, right-aligned tabular numbers. |
| `IndiaMap` | See map rules below. |
| `Card` | Title, optional action, body, footer slot for the provenance chip. |
| `Sparkline` | 7-day price trend, 80x24, no axes, single `brand` stroke, endpoint dot. |
| `TrendDelta` | `+4.2%` with arrow. Up = `accent`, down = `brand`. Never red/green - a price drop is good for a buyer and bad for a farmer, so semantics are role-dependent; use neutral direction colors. |
| `WeatherScene` | See motion below. |
| `NewsCard` | Image or video, headline, summary, publisher, provenance chip. |
| `PostCard` | Farmer report: avatar initial, name, mandi, price, note, photo, "unverified" badge. |
| `DealerDrawer` | Right slide-over, 420 wide, contact rows with tel: links. |
| `EmptyState` | Icon, one-line cause, one suggested action. Never a bare "No data". |
| `SkeletonRow` | Shimmer at 1.2s. Match final row height exactly to avoid layout shift. |

## ProvenanceChip

Every value from a scrape or external API renders one. Format:

```
[globe icon] agmarknet.gov.in - verified 2h ago
```

- Pill, 12px, `text-muted`, `surface-2` background, links to `source_url` in a new tab.
- `< 24h` -> muted. `1-7d` -> muted with "on 14 Aug". `> 7d` -> `warn` color plus a
  "stale" label. Missing timestamp -> `danger`, text "unverified source".
- Tooltip shows the exact ISO timestamp and the collector name.
- Farmer posts use `PostCard`'s "Farmer report - unverified" badge instead. Never a
  provenance chip: UGC is not a source citation.

## Map rules

- **Sequential, single-hue. Never diverging red-green.** Price ramp light -> dark on the
  brand green (`#E4F1E8 -> #2E7D4F`); arrivals ramp on accent amber
  (`#FBF0DC -> #C77D0A`). Darker = more.
- Legend is mandatory and always visible: 5 buckets, quantile-based, with real value
  labels, not "low/high".
- No data for a state = `surface-2` fill with a diagonal hatch, and it says so in the
  legend. Grey must never be mistaken for "cheap".
- Hover: 2px `text` outline plus a tooltip with state, best mandi, modal price. Selected
  state keeps the outline.
- Map and table share one selection state. Hover either, highlight both.

## Motion

Default transition 150ms ease-out. Drawer 220ms. Nothing bounces.

**Weather scenes** (the news-channel look): animated CSS/SVG scenes, one per condition -
`sunny` (slow-rotating rays), `partly-cloudy` (two clouds drifting at different speeds),
`cloudy`, `rain` (falling droplets, staggered delays), `thunderstorm` (rain + timed flash),
`fog`, `hot` (heat shimmer on the sun). 160x120 in the card, CSS-only, no dependency, all
loops 4-8s and seamless.

`@media (prefers-reduced-motion: reduce)` -> render the static SVG frame, no animation.
This is required, not optional.

Ceiling: if CSS scenes look flat next to real broadcast graphics, swap in Lottie JSON
scenes behind the same `<WeatherScene condition=... />` API - no call sites change.
Do not reach for a 3D library (three.js) for this; the cost is not worth 160x120.

**News video**: if a scraped item has a video URL, render it inline in the NewsCard -
YouTube/Vimeo via privacy-mode iframe embed, direct files via `<video controls preload=
"metadata" poster=...>`. Never autoplay with sound. If only an article URL exists, render
the image card and link out.

## States (required for every data component)

1. **Loading** - skeleton matching final layout. For live scrapes, name the source:
   "Fetching contacts from the Punjab APMC portal...".
2. **Empty** - cause plus an action. "No news scraped for Punjab yet - run the collector".
3. **Error** - what failed and what still works: "News unavailable, prices are current".
   A failed card must never blank its neighbours.
4. **Stale** - data older than its refresh interval renders with a `warn` provenance chip
   rather than being hidden. Old-but-labelled beats absent.

## Accessibility

- Contrast 4.5:1 for text, 3:1 for UI edges. The token pairs above are checked.
- Status is never color-only - always icon plus text.
- Full keyboard path: search -> results -> row -> drawer -> close. Visible focus ring,
  2px `brand`, 2px offset.
- Map is decorative-plus: the ranked table is the accessible equivalent and must carry
  every value the map encodes.

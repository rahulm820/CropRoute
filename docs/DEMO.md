# CropRoute - demo runbook

Fleshed out in issue #25. Structure fixed now so every feature is built toward a beat.

## Constraints

- Laptop at 1440x900 on a projector. Nothing below 14px matters on screen.
- Assume the venue wifi is bad. Everything on the happy path must work off seeded data;
  live scrapes are the garnish, not the spine.
- Target 4 minutes. Five beats, roughly 45 seconds each, plus 60 for questions.

## Beats

| # | Beat | Screen | Point being made |
|---|---|---|---|
| 1 | The problem, in one sentence | `/` | Interstate sourcing has no single price+contact view |
| 2 | Search wheat, ranked results | `/results/wheat` | Real gov data, ranked, with freshness stated |
| 3 | Map, then click Punjab | `/state/3` | Region intelligence: price, weather, news, input cost in one place |
| 4 | Open Khanna mandi, live enrich | `/mandi/412` | The scrape is real - watch contacts arrive, with source and timestamp |
| 5 | Break a collector, heal it | `/collectors` | Reliability is engineered and visible, not claimed |

Farmer and wholesaler roles are shown inside beat 3 (a farmer report sits alongside
scraped news in the feed) rather than as a separate login beat. Logging in on stage costs
30 seconds and proves nothing.

## Pre-flight checklist

- [ ] Seeded prices for the demo commodity across at least 8 states
- [ ] At least one mandi deliberately left un-enriched, for the live-scrape beat
- [ ] At least one mandi pre-enriched, as the fallback if the live scrape stalls
- [ ] `collector_runs` seeded with a prior healthy history so baselines exist
- [ ] Farmer post seeded in the feed with today's date
- [ ] News items with one video item and one image item, so both card variants show
- [ ] Browser zoom at 110%, dev panel bookmarked, second tab pre-warmed

## Failure plan

| If | Then |
|---|---|
| Live scrape stalls in beat 4 | Switch to the pre-enriched mandi, say "this one is cached from this morning" |
| Bright Data is down in beat 5 | Run the seeded replay and label it as a replay |
| Weather API times out | Card shows its stale state with a timestamp - point at it, that is the design |

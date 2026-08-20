# CropRoute - product

## Problem

An Indian wholesaler sourcing wheat has no single place to answer: which state is
cheapest right now, is there actually volume arriving there, who do I call at that mandi,
and is anything (weather, strike, MSP news) about to move that price. The data exists -
Agmarknet, state APMC portals, eNAM, IMD, news - but it is scattered across portals with
no contacts, no cross-state ranking, and no freshness signal.

Farmers have the opposite problem: they know today's real gate price at their mandi
before any portal publishes it, and no channel to broadcast it to buyers.

## Users

### Wholesaler / buyer (primary)
Sources 10-500 tonnes at a time, interstate. Cares about landed cost, volume
availability, and a phone number that works. Judges a source by how fresh it is.

Jobs:
- "Where is wheat cheapest with real arrivals this week?"
- "Who do I call at Khanna mandi?"
- "Is anything happening in Punjab that changes this?"

### Farmer / producer (secondary)
Sells at a local mandi. Cares about what buyers elsewhere are paying and about being
seen by buyers.

Jobs:
- "Post today's real rate at my mandi so buyers see it."
- "What are other states paying for my crop?"

### Judge / evaluator (the hackathon reader)
Cares about: is the scraping real, is the self-healing real, is the data attributed.
Served by the provenance chips and the `/collectors` panel.

## What CropRoute does

1. **Ranks** states and mandis for a commodity by modal price and arrival volume, off a
   scheduled pull of the Agmarknet gov dataset.
2. **Enriches** each mandi with dealer and market-office contacts scraped from state
   APMC / eNAM portals via Bright Data collectors, stored with provenance.
3. **Contextualises** each state with weather, agri news, and fertilizer input cost on
   one region page.
4. **Crowdsources** ground-truth price updates from farmers, merged into the wholesaler
   feed alongside scraped news.
5. **Self-heals** its collectors when a source site changes, and shows that happening.

## Non-goals

- Not a marketplace. No transactions, escrow, logistics or payments.
- Not a price prediction model. We report and rank, we do not forecast.
- Not real-time. Mandi prices publish daily; the UI states its freshness rather than
  pretending to be a ticker.
- Not mobile-first. The demo is a laptop. Mobile is a polish-pass nice-to-have.
- Not production auth. See "Identity" below.

## Identity (deliberately minimal)

A user picks a role (farmer / wholesaler) and enters a name and state. No password, no
OTP, no email. The server issues a signed token; the client keeps it in localStorage.

This exists to make the two feed experiences demonstrable, not to secure anything.
Upgrade path when it needs to be real: phone + OTP via any SMS provider, same
`users` table, same token shape.

## Glossary

| Term | Meaning |
|---|---|
| **Mandi** | A regulated wholesale agricultural market. Physical trading yard. |
| **APMC** | Agricultural Produce Market Committee - the state body that runs mandis. |
| **eNAM** | National Agriculture Market - the central online trading platform linking mandis. |
| **Agmarknet** | Gov portal publishing daily mandi prices and arrivals. Our baseline data. |
| **Modal price** | The most frequently traded price of the day. The headline number, more useful than min/max. |
| **Arrivals** | Quantity that physically arrived at the mandi that day (tonnes). The supply signal. |
| **Quintal** | 100 kg. The standard price unit on Agmarknet. |
| **Commission agent / arhtiya** | Licensed middleman at a mandi who brokers between farmer and buyer. Our "dealer" contacts. |
| **MSP** | Minimum Support Price - the floor price the government commits to for certain crops. |
| **Gate price** | What a farmer actually receives at the mandi gate, often below the published modal price. |

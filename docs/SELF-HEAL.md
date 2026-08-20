# CropRoute - self-healing collectors

A full judging criterion. The requirement is not "we handle errors" - it is a visible,
reproducible break-and-heal, backed by a log.

## Why collectors break

State portals redesign without notice. A table becomes a div, a phone column becomes an
image, a page adds a consent interstitial. The scrape keeps returning 200 with rows; the
rows are just missing a field. Silent partial failure is the normal failure mode, not a
crash. Detection therefore watches field completeness, not HTTP status.

## State machine

```
   healthy --(completeness drop)--> broken --(heal run ok)--> self_healed
      ^                               |                            |
      +---------(next clean run)------+----------------------------+
```

| Status | Meaning |
|---|---|
| `healthy` | Last run met the completeness baseline for every required field. |
| `broken` | A required field that was previously populated came back empty across the run. |
| `self_healed` | A heal was triggered and a subsequent run met the baseline again. |
| `failed` | Heal ran and the next run still failed. Needs a human. Say so in the UI. |

Every transition is one row in `collector_runs(collector_id, target_state, status,
ran_at, notes)`. `notes` carries the evidence, e.g. "office_phone empty in 40/41 rows,
baseline 0.95". The log is the demo artifact; a status badge with no evidence convinces
nobody.

## Detection

Per collector, per required field, keep a rolling completeness baseline (fraction of rows
with a non-empty value) from the last N healthy runs.

```
completeness(field) = non_empty_rows / total_rows
broken if total_rows > 0 and completeness < 0.5 * baseline for any required field
```

Guards that matter:

- `total_rows == 0` is a fetch failure, not a field break. Log it, retry once, do not
  flap the status.
- Never flag on the first run - there is no baseline yet.
- For a known-flaky source, require two consecutive sub-threshold runs before declaring
  `broken`, so one bad night does not trigger a heal loop.

## Healing

On `broken`: re-derive the extraction from the collector's original plain-English field
description via Bright Data self-heal, then re-run and compare against baseline again.
Log the transition either way. A heal that did not work is still data, and hiding it is
worse than showing it.

The monitor runs on a schedule (hourly is plenty) and is also triggerable from
`POST /api/collectors/trigger`.

## The demo moment

Rehearse this. It is the most convincing 45 seconds of the presentation.

1. `/collectors` shows every collector `healthy` with completeness bars.
2. Trigger `POST /api/collectors/trigger {"collector": "punjab_apmc", "force_break": true}`.
   The run uses a deliberately wrong field expectation, so `office_phone` comes back empty.
3. Panel flips to `broken`, timeline gains a row carrying the evidence string.
4. Trigger the heal. Panel shows `self_healed`, the completeness bar refills, and the
   timeline shows all three transitions with timestamps.

Do not fake step 2 with a hardcoded status write. `force_break` must run a real collector
with a broken expectation so the detector genuinely detects it. If a judge asks whether
it is real, the answer has to survive them picking a different collector.

Fallback if Bright Data is slow or down on demo day: run the same sequence against seeded
`collector_runs` data and say plainly that it is a replay. A labelled replay is credible;
a silent fake is not.

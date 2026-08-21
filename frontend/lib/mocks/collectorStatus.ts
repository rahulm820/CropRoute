/**
 * Mock fixture for GET /api/collectors/status.
 *
 * Exercises all four collector states across multiple collectors with varied
 * field_completeness values and realistic run histories. Used for dev/screenshot
 * verification until the backend endpoint ships.
 *
 * Shape matches docs/API.md § Collectors exactly.
 */

export interface CollectorRunEntry {
  status: "healthy" | "broken" | "self_healed" | "failed";
  ran_at: string;
  notes: string;
}

export interface CollectorStatus {
  collector: string;
  target_state: string;
  target_url: string;
  status: "healthy" | "broken" | "self_healed" | "failed";
  last_run: string;
  field_completeness: number;
  runs: CollectorRunEntry[];
}

/**
 * Generates ISO timestamps relative to "now" for realistic-looking data.
 * offset is in minutes (negative = past).
 */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const MOCK_COLLECTORS: CollectorStatus[] = [
  // ── healthy: high completeness, clean history ──────────────────────
  {
    collector: "punjab_apmc",
    target_state: "Punjab",
    target_url: "https://enam.gov.in/web/dashboard/trade-data",
    status: "healthy",
    last_run: ago(12),
    field_completeness: 0.97,
    runs: [
      { status: "healthy", ran_at: ago(12), notes: "" },
      { status: "healthy", ran_at: ago(72), notes: "" },
    ],
  },

  // ── broken: mid-heal-cycle, realistic evidence string ──────────────
  {
    collector: "maharashtra_apmc",
    target_state: "Maharashtra",
    target_url: "https://mahaapit.gov.in/",
    status: "broken",
    last_run: ago(8),
    field_completeness: 0.41, // below 0.5 → danger bar
    runs: [
      {
        status: "broken",
        ran_at: ago(8),
        notes:
          "office_phone empty in 40/41 rows, baseline 0.95 — portal switched phone column to an embedded image",
      },
      { status: "healthy", ran_at: ago(68), notes: "" },
      { status: "healthy", ran_at: ago(128), notes: "" },
    ],
  },

  // ── self_healed: shows the broken→self_healed arc ──────────────────
  {
    collector: "karnataka_apmc",
    target_state: "Karnataka",
    target_url: "https://krama.karnataka.gov.in/",
    status: "self_healed",
    last_run: ago(5),
    field_completeness: 0.92,
    runs: [
      {
        status: "self_healed",
        ran_at: ago(5),
        notes: "re-derived extraction via Bright Data self-heal — office_phone recovery confirmed",
      },
      {
        status: "broken",
        ran_at: ago(35),
        notes:
          "office_phone empty in 38/39 rows, baseline 0.93 — consent interstitial added to portal",
      },
      { status: "healthy", ran_at: ago(95), notes: "" },
    ],
  },

  // ── failed: heal ran and still failing — needs a human ─────────────
  {
    collector: "rajasthan_apmc",
    target_state: "Rajasthan",
    target_url: "https://rajmandi.rajasthan.gov.in/",
    status: "failed",
    last_run: ago(3),
    field_completeness: 0.22, // well below 0.5 → danger
    runs: [
      {
        status: "failed",
        ran_at: ago(3),
        notes:
          "heal attempted — office_phone still empty in 44/45 rows after re-derived extraction. Portal now renders contacts as a PDF download, not HTML. Manual collector update required.",
      },
      {
        status: "broken",
        ran_at: ago(33),
        notes:
          "office_phone empty in 44/45 rows, baseline 0.96 — table replaced with embedded PDF viewer",
      },
      { status: "healthy", ran_at: ago(93), notes: "" },
      { status: "healthy", ran_at: ago(153), notes: "" },
    ],
  },

  // ── healthy with longer history (5 entries) — tests timeline ───────
  {
    collector: "mp_agri_news",
    target_state: "Madhya Pradesh",
    target_url: "https://mpmandiboard.gov.in/",
    status: "healthy",
    last_run: ago(15),
    field_completeness: 0.88, // between 0.8 and 1.0 → ok bar
    runs: [
      { status: "healthy", ran_at: ago(15), notes: "" },
      {
        status: "self_healed",
        ran_at: ago(75),
        notes: "re-derived extraction — headline field mapping corrected",
      },
      {
        status: "broken",
        ran_at: ago(135),
        notes:
          "headline empty in 12/15 rows, baseline 0.98 — news site switched from article tags to div.card layout",
      },
      { status: "healthy", ran_at: ago(195), notes: "" },
      { status: "healthy", ran_at: ago(255), notes: "" },
    ],
  },

  // ── healthy, warn-level completeness (0.65) — edge case ────────────
  {
    collector: "fertilizer_retail",
    target_state: "Uttar Pradesh",
    target_url: "https://farmer.gov.in/FarmerHome.aspx",
    status: "healthy",
    last_run: ago(25),
    field_completeness: 0.65, // between 0.5 and 0.8 → warn bar
    runs: [
      { status: "healthy", ran_at: ago(25), notes: "" },
      { status: "healthy", ran_at: ago(85), notes: "" },
    ],
  },
];

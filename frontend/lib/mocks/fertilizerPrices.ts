/**
 * Mock fixture for GET /api/state/:id/fertilizer.
 *
 * Exercises the realistic case (three products with mixed positive/negative
 * deltas) and the edge case where delta_pct is null (pack-size change
 * invalidated the prior data point, so the backend cannot produce a
 * trustworthy comparison).
 *
 * Shape matches docs/API.md § GET /api/state/:id/fertilizer exactly.
 */

export interface FertilizerPrice {
  product: string;
  price: number;
  unit: string;
  delta_pct: number | null;
  source_url: string;
  scraped_at: string;
}

/**
 * Generates ISO timestamps relative to "now" for realistic-looking data.
 * offset is in minutes (negative = past).
 */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * Realistic case: Punjab fertilizer prices.
 * Three products per issue AC: Urea, DAP, MOP.
 * Mixed positive/negative deltas. One null delta (MOP) to exercise the
 * "no comparison available" empty state.
 */
export const MOCK_FERTILIZER_PUNJAB: FertilizerPrice[] = [
  {
    product: "Urea",
    price: 266,
    unit: "45kg bag",
    delta_pct: 0.0,
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(45),
  },
  {
    product: "DAP",
    price: 1350,
    unit: "50kg bag",
    delta_pct: 4.2,
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(45),
  },
  {
    product: "MOP",
    price: 1700,
    unit: "50kg bag",
    delta_pct: null, // pack-size change invalidated prior comparison
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(45),
  },
];

/**
 * Edge case: all products have valid deltas (positive, negative, zero).
 * Maharashtra state.
 */
export const MOCK_FERTILIZER_MAHARASHTRA: FertilizerPrice[] = [
  {
    product: "Urea",
    price: 270,
    unit: "45kg bag",
    delta_pct: 1.5,
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(120),
  },
  {
    product: "DAP",
    price: 1340,
    unit: "50kg bag",
    delta_pct: -2.8,
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(120),
  },
  {
    product: "MOP",
    price: 1680,
    unit: "50kg bag",
    delta_pct: 0.0,
    source_url: "https://farmer.gov.in/FarmerHome.aspx",
    scraped_at: ago(120),
  },
];

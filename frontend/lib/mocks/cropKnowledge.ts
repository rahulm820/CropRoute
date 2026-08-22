/**
 * Mock fixture for crop_knowledge data.
 *
 * Shape matches docs/ARCHITECTURE.md schema:
 *   crop_knowledge(id, commodity_id, state_id, sowing_window, harvest_window,
 *                  districts, notes)
 *
 * Includes a fully-populated case and a "not yet covered" case (null) to
 * exercise the honest-empty-state requirement from issue #31.
 */

export interface CropKnowledge {
  id: number;
  commodity_id: number;
  state_id: number;
  sowing_window: string;
  harvest_window: string;
  districts: string[];
  notes: string;
}

/**
 * Fully populated case: Wheat in Punjab.
 */
export const MOCK_CROP_KNOWLEDGE_WHEAT_PUNJAB: CropKnowledge = {
  id: 1,
  commodity_id: 1,
  state_id: 3,
  sowing_window: "Oct – Nov",
  harvest_window: "Mar – Apr",
  districts: ["Ludhiana", "Amritsar", "Patiala", "Sangrur", "Bathinda"],
  notes:
    "PBW-725 and HD-3226 are the dominant varieties. Procurement at MSP (₹2,275/qtl for 2026-27) through state agencies begins in April. Quality parameters: max 12% moisture, 1% foreign matter.",
};

/**
 * Lookup by commodity + state. Returns null for combinations without
 * seeded knowledge — this is the honest-empty-state path.
 */
export function getMockCropKnowledge(
  commodityId: number,
  stateId: number,
): CropKnowledge | null {
  // Only one seeded entry: Wheat (1) in Punjab (3)
  if (commodityId === 1 && stateId === 3) {
    return MOCK_CROP_KNOWLEDGE_WHEAT_PUNJAB;
  }
  // Everything else: not yet covered
  return null;
}

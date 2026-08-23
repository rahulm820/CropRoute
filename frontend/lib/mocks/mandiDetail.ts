/**
 * Mock fixture for GET /api/mandi/:id.
 *
 * Follows the same mocked-data pattern as collectorStatus.ts:
 * gated behind USE_MOCK_MANDI_DETAIL in the consuming component,
 * dynamically imported so the fixture stays out of production bundles.
 *
 * Shape matches docs/API.md § GET /api/mandi/:id exactly.
 */

export interface MandiOffice {
  address: string;
  phone: string;
  source_url: string;
  scraped_at: string;
}

export interface MandiDealer {
  name: string;
  role: string;
  phone: string;
  source_url: string;
  scraped_at: string;
}

export interface MandiPrice {
  commodity: string;
  modal_price: number;
  arrival_qty: number;
  date: string;
}

export interface MandiEnrichment {
  status: "fresh" | "stale" | "running" | "failed";
  collector: string;
}

export interface MandiDetailResponse {
  mandi: {
    id: number;
    name: string;
    state: string;
    lat: number;
    lng: number;
  };
  prices: MandiPrice[];
  office: MandiOffice | null;
  dealers: MandiDealer[];
  enrichment: MandiEnrichment;
}

/**
 * Generates ISO timestamps relative to "now" for realistic-looking data.
 * offset is in minutes (negative = past).
 */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * Realistic case: Khanna mandi in Punjab.
 * - Office contact present with fresh timestamp
 * - 3 dealers: two fresh, one stale (>7 days old)
 */
export const MOCK_MANDI_DETAIL_412: MandiDetailResponse = {
  mandi: {
    id: 412,
    name: "Khanna",
    state: "Punjab",
    lat: 30.7,
    lng: 76.2,
  },
  prices: [
    {
      commodity: "Wheat",
      modal_price: 2350,
      arrival_qty: 1840,
      date: "2026-08-18",
    },
  ],
  office: {
    address:
      "Office of the Market Committee, Grain Market, Khanna, Ludhiana, Punjab 141401",
    phone: "+91-1628-224567",
    source_url: "https://punjabmandinetwork.com/khanna",
    scraped_at: ago(180), // ~3 hours ago — fresh
  },
  dealers: [
    {
      name: "Harpreet Singh & Sons",
      role: "commission agent",
      phone: "+91-98765-43210",
      source_url: "https://punjabmandinetwork.com/khanna/dealers",
      scraped_at: ago(180), // ~3 hours ago — fresh
    },
    {
      name: "Gupta Trading Co.",
      role: "commission agent",
      phone: "+91-98765-12345",
      source_url: "https://punjabmandinetwork.com/khanna/dealers",
      scraped_at: ago(360), // ~6 hours ago — still fresh
    },
    {
      name: "Rajinder Agri Services",
      role: "licensed dealer",
      phone: "+91-94170-67890",
      source_url: "https://punjabmandinetwork.com/khanna/dealers",
      scraped_at: ago(60 * 24 * 12), // ~12 days ago — stale
    },
  ],
  enrichment: {
    status: "fresh",
    collector: "punjab_mandi_network",
  },
};

/**
 * Edge case: Bhopal mandi in Madhya Pradesh.
 * Office contact present, zero dealers listed.
 * Per DATA-SOURCES.md: "some state portals return image-based contact tables
 * with no extractable phones" — so an empty dealers array with a populated
 * office block is a real, expected state, not a bug.
 */
export const MOCK_MANDI_DETAIL_815: MandiDetailResponse = {
  mandi: {
    id: 815,
    name: "Bhopal",
    state: "Madhya Pradesh",
    lat: 23.26,
    lng: 77.41,
  },
  prices: [
    {
      commodity: "Soybean",
      modal_price: 4520,
      arrival_qty: 2310,
      date: "2026-08-17",
    },
  ],
  office: {
    address:
      "Krishi Upaj Mandi Samiti, Karond Bypass Rd, Bhopal, Madhya Pradesh 462038",
    phone: "+91-755-2660123",
    source_url: "https://mpagrifacts.com/mandi/bhopal",
    scraped_at: ago(60 * 24 * 2), // ~2 days ago — dated
  },
  dealers: [], // image-based contact table, no extractable phones
  enrichment: {
    status: "stale",
    collector: "mp_market_feed",
  },
};

/**
 * Lookup by mandi ID — simulates the API route.
 * Returns null for unknown IDs (triggers empty state in the drawer).
 */
export function getMockMandiDetail(
  mandiId: string | number,
): MandiDetailResponse | null {
  const id = typeof mandiId === "string" ? parseInt(mandiId, 10) : mandiId;
  switch (id) {
    case 412:
      return MOCK_MANDI_DETAIL_412;
    case 815:
      return MOCK_MANDI_DETAIL_815;
    default:
      // Return the realistic case as fallback for any other ID during dev
      return {
        ...MOCK_MANDI_DETAIL_412,
        mandi: { ...MOCK_MANDI_DETAIL_412.mandi, id },
      };
  }
}

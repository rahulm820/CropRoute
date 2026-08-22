"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import ProvenanceChip from "./ProvenanceChip";
import TrendDelta from "./TrendDelta";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import type { FertilizerPrice } from "@/lib/mocks/fertilizerPrices";

// ── Mock switch ────────────────────────────────────────────────────────
// Remove once backend fertilizer endpoint ships (issue #30).
// When true, the card uses the fixture instead of hitting the API.
const USE_MOCK_FERTILIZER = true;
// ───────────────────────────────────────────────────────────────────────

interface FertilizerCardProps {
  /** State ID for the API call. */
  stateId: number;
  /** State name for display in empty/error messages. */
  stateName: string;
}

/**
 * Loading skeleton — matches the final three-row layout to prevent
 * layout shift. Uses shimmer at 1.2s per spec.
 */
function FertilizerSkeleton() {
  return (
    <div
      className="fertilizer-card"
      aria-busy="true"
      aria-label="Loading fertilizer prices"
    >
      <div className="fertilizer-card-header">
        <div
          className="skeleton-shimmer"
          style={{ width: "50%", height: 12, borderRadius: 9999 }}
        />
      </div>
      <div className="fertilizer-card-body">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="fertilizer-row" aria-hidden="true">
            <div
              className="skeleton-shimmer"
              style={{ width: "35%", height: 12, borderRadius: 9999 }}
            />
            <div
              className="skeleton-shimmer"
              style={{ width: "25%", height: 12, borderRadius: 9999 }}
            />
            <div
              className="skeleton-shimmer"
              style={{ width: "20%", height: 12, borderRadius: 9999 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FertilizerCard — displays scraped fertilizer prices for a state.
 *
 * Matches GET /api/state/:id/fertilizer response shape from docs/API.md:
 *   product, price, unit, delta_pct, source_url, scraped_at.
 *
 * Shows exactly three products: Urea, DAP, MOP (per issue AC).
 * Each row: product name, price (as given by API — already normalized
 * per DATA-SOURCES.md), unit label, and TrendDelta for delta_pct.
 *
 * Defensive handling: if delta_pct is null/undefined/NaN for a product
 * (backend can't produce a trustworthy comparison, e.g. pack-size change
 * invalidated the prior data point), display "—" with an accessible
 * label — never a fabricated 0% or a broken row.
 */
export default function FertilizerCard({
  stateId,
  stateName,
}: FertilizerCardProps) {
  const [products, setProducts] = useState<FertilizerPrice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    try {
      let data: FertilizerPrice[];

      if (USE_MOCK_FERTILIZER) {
        // Dynamic import keeps fixture out of production bundles
        const { MOCK_FERTILIZER_PUNJAB } = await import(
          "@/lib/mocks/fertilizerPrices"
        );
        data = MOCK_FERTILIZER_PUNJAB;
      } else {
        data = await apiFetch<FertilizerPrice[]>(
          `/api/state/${stateId}/fertilizer`,
        );
      }

      setProducts(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch fertilizer prices",
      );
    } finally {
      setLoading(false);
    }
  }, [stateId]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // ── Loading ──
  if (loading && !products) {
    return <FertilizerSkeleton />;
  }

  // ── Error (no data at all) ──
  if (error && !products) {
    return (
      <div className="fertilizer-card">
        <div className="fertilizer-card-header">
          <h2 className="fertilizer-card-title">Fertilizer Prices</h2>
        </div>
        <ErrorState
          message="Fertilizer prices unavailable"
          fallback={`Other data for ${stateName} is still current`}
        />
      </div>
    );
  }

  // ── Empty (API returned empty array) ──
  if (products && products.length === 0) {
    return (
      <div className="fertilizer-card">
        <div className="fertilizer-card-header">
          <h2 className="fertilizer-card-title">Fertilizer Prices</h2>
        </div>
        <EmptyState
          icon={
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          }
          message={`No fertilizer price data scraped for ${stateName} yet — run the fertilizer_retail collector.`}
        />
      </div>
    );
  }

  // ── Data ──
  return (
    <div
      className="fertilizer-card"
      role="region"
      aria-label={`Fertilizer prices for ${stateName}`}
      id={`fertilizer-card-${stateId}`}
    >
      <div className="fertilizer-card-header">
        <h2 className="fertilizer-card-title">Fertilizer Prices</h2>
      </div>

      <div className="fertilizer-card-body">
        {products!.map((p) => (
          <div key={p.product} className="fertilizer-row">
            <div className="fertilizer-row-product">
              <span className="fertilizer-product-name">{p.product}</span>
              <span className="fertilizer-unit">{p.unit}</span>
            </div>

            <div className="fertilizer-row-price">
              <span className="fertilizer-price tabular-nums">
                ₹{p.price.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="fertilizer-row-delta">
              {p.delta_pct !== null &&
              p.delta_pct !== undefined &&
              !Number.isNaN(p.delta_pct) ? (
                <TrendDelta value={p.delta_pct} />
              ) : (
                <span
                  className="fertilizer-no-delta"
                  title="No comparison available — prior data point may have used a different pack size"
                  aria-label="No price comparison available"
                >
                  —
                </span>
              )}
            </div>

            <div className="fertilizer-row-provenance">
              <ProvenanceChip
                sourceUrl={p.source_url}
                scrapedAt={p.scraped_at}
                collectorName="fertilizer_retail"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import type { CropKnowledge } from "@/lib/mocks/cropKnowledge";

// ── Mock switch ────────────────────────────────────────────────────────
// Remove once backend crop knowledge seed script ships (issue #31).
// When true, the card uses the fixture instead of hitting the API.
const USE_MOCK_CROP_KNOWLEDGE = true;
// ───────────────────────────────────────────────────────────────────────

interface CropKnowledgeCardProps {
  /** Commodity ID for the lookup. */
  commodityId: number;
  /** Commodity name for display. */
  commodityName: string;
  /** State ID for the lookup. */
  stateId: number;
  /** State name for display. */
  stateName: string;
}

/**
 * Loading skeleton — matches the final card layout to prevent shift.
 */
function CropKnowledgeSkeleton() {
  return (
    <div
      className="crop-knowledge-card"
      aria-busy="true"
      aria-label="Loading crop knowledge"
    >
      <div className="crop-knowledge-card-header">
        <div
          className="skeleton-shimmer"
          style={{ width: "60%", height: 12, borderRadius: 9999 }}
        />
      </div>
      <div className="crop-knowledge-card-body">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="crop-knowledge-row" aria-hidden="true">
            <div
              className="skeleton-shimmer"
              style={{ width: "30%", height: 12, borderRadius: 9999 }}
            />
            <div
              className="skeleton-shimmer"
              style={{ width: "55%", height: 12, borderRadius: 9999 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CropKnowledgeCard — displays crop knowledge for a commodity + state.
 *
 * Matches the crop_knowledge shape from docs/ARCHITECTURE.md schema:
 *   sowing_window, harvest_window, districts, notes.
 *
 * Scoped to a commodity + state; the parent decides which commodity is
 * "top" for that state — this component just renders what it's given.
 *
 * HONEST EMPTY STATE (explicit AC from issue #31):
 * For a crop/state combination with no seeded knowledge yet, the message
 * specifically says knowledge for this crop/region isn't covered yet —
 * distinct from a fetch failure or a truly empty result.
 */
export default function CropKnowledgeCard({
  commodityId,
  commodityName,
  stateId,
  stateName,
}: CropKnowledgeCardProps) {
  const [knowledge, setKnowledge] = useState<CropKnowledge | null | undefined>(
    undefined, // undefined = not yet loaded; null = loaded but not covered
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchKnowledge = useCallback(async () => {
    try {
      let data: CropKnowledge | null;

      if (USE_MOCK_CROP_KNOWLEDGE) {
        const { getMockCropKnowledge } = await import(
          "@/lib/mocks/cropKnowledge"
        );
        data = getMockCropKnowledge(commodityId, stateId);
      } else {
        // The state bundle endpoint returns knowledge in the "knowledge" section
        const response = await apiFetch<{
          status: string;
          data: CropKnowledge[] | null;
        }>(`/api/state/${stateId}`, {
          params: { commodity: commodityId },
        });
        // Find the matching commodity knowledge or null
        data =
          response.data?.find((k) => k.commodity_id === commodityId) ?? null;
      }

      setKnowledge(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch crop knowledge",
      );
    } finally {
      setLoading(false);
    }
  }, [commodityId, stateId]);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  // ── Loading ──
  if (loading && knowledge === undefined) {
    return <CropKnowledgeSkeleton />;
  }

  // ── Error (fetch failure) ──
  if (error && knowledge === undefined) {
    return (
      <div className="crop-knowledge-card">
        <div className="crop-knowledge-card-header">
          <h2 className="crop-knowledge-card-title">
            {commodityName} — Crop Knowledge
          </h2>
        </div>
        <ErrorState
          message="Crop knowledge unavailable"
          fallback={`Price and weather data for ${stateName} are still current`}
        />
      </div>
    );
  }

  // ── Honest empty state: knowledge not yet seeded for this combination ──
  if (knowledge === null) {
    return (
      <div className="crop-knowledge-card">
        <div className="crop-knowledge-card-header">
          <h2 className="crop-knowledge-card-title">
            {commodityName} — Crop Knowledge
          </h2>
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
              <path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7.5L12 20l-3-3.5C7 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          }
          message={`Crop knowledge for ${commodityName} in ${stateName} isn\u2019t in our seed data yet.`}
        />
      </div>
    );
  }

  // ── Defensive guard — should not be reachable after the above checks ──
  if (!knowledge) {
    return null;
  }

  // ── Data ──
  return (
    <div
      className="crop-knowledge-card"
      role="region"
      aria-label={`Crop knowledge for ${commodityName} in ${stateName}`}
      id={`crop-knowledge-card-${stateId}-${commodityId}`}
    >
      <div className="crop-knowledge-card-header">
        <h2 className="crop-knowledge-card-title">
          {commodityName} — Crop Knowledge
        </h2>
      </div>

      <div className="crop-knowledge-card-body">
        {/* Sowing window */}
        <div className="crop-knowledge-row">
          <span className="crop-knowledge-label">Sowing</span>
          <span className="crop-knowledge-value">{knowledge.sowing_window}</span>
        </div>

        {/* Harvest window */}
        <div className="crop-knowledge-row">
          <span className="crop-knowledge-label">Harvest</span>
          <span className="crop-knowledge-value">
            {knowledge.harvest_window}
          </span>
        </div>

        {/* Major growing districts */}
        <div className="crop-knowledge-row crop-knowledge-row-districts">
          <span className="crop-knowledge-label">Major districts</span>
          <span className="crop-knowledge-value">
            {knowledge.districts.join(", ")}
          </span>
        </div>

        {/* Grading notes */}
        {knowledge.notes && (
          <div className="crop-knowledge-row crop-knowledge-row-notes">
            <span className="crop-knowledge-label">Notes</span>
            <span className="crop-knowledge-value crop-knowledge-notes">
              {knowledge.notes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

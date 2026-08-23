"use client";

import { useState } from "react";
import {
  SearchBar,
  RankedTable,
  IndiaMap,
  DealerDrawer,
  EmptyState,
  ErrorState,
} from "@/components";
import type { SearchResponse } from "@/components";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ResultsClientProps {
  item: string;
  initialData: SearchResponse | null;
  initialError: string | null;
}

/* ------------------------------------------------------------------ */
/*  Empty state icon                                                   */
/* ------------------------------------------------------------------ */

function MapIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ResultsClient                                                      */
/* ------------------------------------------------------------------ */

export default function ResultsClient({
  item,
  initialData,
  initialError,
}: ResultsClientProps) {
  /* ---- Shared selection state — single source of truth ---- */
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);

  /* ---- Mandi drawer state ---- */
  const [selectedMandiId, setSelectedMandiId] = useState<string | null>(null);

  /* ---- Metric toggle ---- */
  const [metric, setMetric] = useState<"price" | "arrivals">("price");

  /* ---- Mobile view toggle ---- */
  const [mobileView, setMobileView] = useState<"table" | "map">("table");

  const data = initialData;
  const error = initialError;
  const hasResults = data && data.results.length > 0;
  const isEmpty = data && data.results.length === 0;

  return (
    <main className="max-w-content mx-auto px-4 py-6">
      {/* ---- Search bar at top ---- */}
      <div className="flex justify-center mb-6">
        <SearchBar />
      </div>

      {/* ---- Page header ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[32px] leading-[38px] font-semibold text-text">
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </h1>
          {data?.last_refreshed && (
            <p className="text-[12px] leading-[16px] text-text-muted mt-1">
              Prices as of{" "}
              {formatRefreshDate(data.last_refreshed)}
            </p>
          )}
        </div>

        {/* ---- Metric toggle ---- */}
        {hasResults && (
          <div className="metric-toggle" role="radiogroup" aria-label="Map metric">
            <button
              type="button"
              role="radio"
              aria-checked={metric === "price"}
              className={metric === "price" ? "metric-toggle-active" : ""}
              onClick={() => setMetric("price")}
            >
              Price
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={metric === "arrivals"}
              className={metric === "arrivals" ? "metric-toggle-active" : ""}
              onClick={() => setMetric("arrivals")}
            >
              Arrivals
            </button>
          </div>
        )}
      </div>

      {/* ---- Error state ---- */}
      {error && (
        <div className="mb-6">
          <ErrorState
            message="Could not load search results"
            fallback={error}
          />
        </div>
      )}

      {/* ---- Empty state ---- */}
      {isEmpty && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-card p-card-padding">
            <EmptyState
              icon={<SearchIcon />}
              message={`No mandi reported ${item} in the last 7 days — try a different commodity`}
            />
          </div>
          <div className="bg-surface border border-border rounded-card p-card-padding">
            <EmptyState
              icon={<MapIcon />}
              message={`No state data available for ${item}`}
            />
          </div>
        </div>
      )}

      {/* ---- Data state: map + table ---- */}
      {hasResults && (
        <>
          {/* Mobile view toggle — only visible on small screens */}
          <div className="flex justify-center mb-4 lg:hidden">
            <div className="view-toggle" role="radiogroup" aria-label="View mode">
              <button
                type="button"
                role="radio"
                aria-checked={mobileView === "table"}
                className={mobileView === "table" ? "view-toggle-active" : ""}
                onClick={() => setMobileView("table")}
              >
                Table
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mobileView === "map"}
                className={mobileView === "map" ? "view-toggle-active" : ""}
                onClick={() => setMobileView("map")}
              >
                Map
              </button>
            </div>
          </div>

          {/* Desktop: side-by-side | Mobile: toggled */}
          <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
            {/* Table panel */}
            <div
              className={`
                min-w-0
                ${mobileView !== "table" ? "hidden lg:block" : ""}
              `}
            >
              <RankedTable
                data={data}
                selectedStateId={selectedStateId}
                onSelectRow={(stateId) =>
                  setSelectedStateId(
                    stateId === selectedStateId ? null : stateId
                  )
                }
                onSelectMandi={(mandiId) =>
                  setSelectedMandiId(String(mandiId))
                }
              />
            </div>

            {/* Map panel */}
            <div
              className={`
                bg-surface border border-border rounded-card p-card-padding
                ${mobileView !== "map" ? "hidden lg:block" : ""}
              `}
            >
              <IndiaMap
                results={data.results}
                metric={metric}
                selectedStateId={selectedStateId}
                onSelectState={setSelectedStateId}
              />
            </div>
          </div>
        </>
      )}

      {/* ---- Loading placeholder (when server fetch returned null without error) ---- */}
      {!data && !error && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {["State", "Mandi", "Modal Price", "Arrivals", "Updated"].map(
                    (label) => (
                      <th
                        key={label}
                        className="px-3 py-3 text-[12px] leading-[16px] font-semibold uppercase tracking-wide text-text-muted border-b border-border text-left"
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} style={{ height: "48px" }} aria-hidden="true">
                    {Array.from({ length: 5 }, (_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div
                          className="h-3 rounded bg-surface-2 skeleton-shimmer"
                          style={{
                            width: j === 0 ? "60%" : j === 4 ? "40%" : "70%",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="map-skeleton" aria-hidden="true" />
        </div>
      )}

      {/* ---- Dealer drawer ---- */}
      <DealerDrawer
        mandiId={selectedMandiId}
        onClose={() => setSelectedMandiId(null)}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Format ISO 8601 timestamp to a deterministic display string.
 * Uses UTC-only parsing to avoid server/client hydration mismatches.
 */
const UTC_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatRefreshDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const month = UTC_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

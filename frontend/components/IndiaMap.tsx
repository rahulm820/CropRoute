"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import type { SearchResult } from "./RankedTable";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface IndiaMapProps {
  results: SearchResult[];
  metric: "price" | "arrivals";
  selectedStateId: number | null;
  onSelectState: (stateId: number | null) => void;
}

interface StateAggregation {
  stateId: number;
  stateName: string;
  value: number; // lowest modal_price or summed arrivals
  bestMandi: string;
  bestMandiPrice: number;
}

/* ------------------------------------------------------------------ */
/*  GeoJSON URL — served from public/data/                             */
/* ------------------------------------------------------------------ */

const GEO_URL = "/data/india-states.json";

/* ------------------------------------------------------------------ */
/*  State name normalization                                           */
/*  GeoJSON uses NAME_1; API uses state names that may differ.         */
/*  This map normalizes GeoJSON names → canonical names matching API.  */
/* ------------------------------------------------------------------ */

function normalizeStateName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Maps GeoJSON NAME_1 values to the canonical API state names.
 * Only entries that differ need to be listed here.
 */
const GEOJSON_TO_API_ALIASES: Record<string, string> = {
  "orissa": "Odisha",
  "uttaranchal": "Uttarakhand",
  "andaman and nicobar": "Andaman And Nicobar",
  "dadra and nagar haveli": "Dadra And Nagar Haveli",
  "daman and diu": "Daman And Diu",
  "jammu and kashmir": "Jammu And Kashmir",
  "delhi": "NCT of Delhi",
};

/**
 * Reverse map: API state name (normalized) → GeoJSON NAME_1 (normalized).
 * Built from the aliases above.
 */
const API_TO_GEOJSON_ALIASES: Record<string, string> = {};
for (const [geoKey, apiName] of Object.entries(GEOJSON_TO_API_ALIASES)) {
  API_TO_GEOJSON_ALIASES[normalizeStateName(apiName)] = geoKey;
}

function matchGeoNameToApiState(
  geoName: string,
  apiStatesNormalized: Map<string, StateAggregation>
): StateAggregation | null {
  const normalized = normalizeStateName(geoName);

  // Direct match
  const direct = apiStatesNormalized.get(normalized);
  if (direct) return direct;

  // Check if GeoJSON name has an alias to an API name
  const aliasedApiName = GEOJSON_TO_API_ALIASES[normalized];
  if (aliasedApiName) {
    const aliased = apiStatesNormalized.get(normalizeStateName(aliasedApiName));
    if (aliased) return aliased;
  }

  // Check if any API state name has an alias to this GeoJSON name
  for (const [apiNorm, agg] of apiStatesNormalized) {
    const reverseAlias = API_TO_GEOJSON_ALIASES[apiNorm];
    if (reverseAlias === normalized) return agg;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Color ramps — per UI-DESIGN.md "Map rules"                         */
/*  Sequential, single-hue. Darker = more.                             */
/* ------------------------------------------------------------------ */

const PRICE_RAMP = ["#E4F1E8", "#B5D9BF", "#7BBF95", "#4A9E6B", "#2E7D4F"];
const ARRIVALS_RAMP = ["#FBF0DC", "#EDD4A3", "#D9B56A", "#C79831", "#C77D0A"];

function getColorForQuantile(
  value: number,
  buckets: number[],
  ramp: string[]
): string {
  for (let i = 0; i < buckets.length; i++) {
    if (value <= buckets[i]) return ramp[i];
  }
  return ramp[ramp.length - 1];
}

/**
 * Compute 5 quantile bucket boundaries from a sorted array of values.
 */
function computeQuantileBuckets(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0, 0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const idx = Math.min(
      Math.ceil((i / 5) * sorted.length) - 1,
      sorted.length - 1
    );
    buckets.push(sorted[idx]);
  }
  return buckets;
}

/* ------------------------------------------------------------------ */
/*  Number formatting helpers                                          */
/* ------------------------------------------------------------------ */

function formatIndianNumber(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

function formatLegendValue(value: number, metric: "price" | "arrivals"): string {
  if (metric === "price") return `₹${formatIndianNumber(value)}`;
  return `${formatIndianNumber(value)} qtl`;
}

/* ------------------------------------------------------------------ */
/*  IndiaMap component                                                 */
/* ------------------------------------------------------------------ */

export default function IndiaMap({
  results,
  metric,
  selectedStateId,
  onSelectState,
}: IndiaMapProps) {
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    stateName: string;
    bestMandi: string;
    modalPrice: number;
    value: number;
  } | null>(null);

  /* ---- Aggregate results by state ---- */
  const { stateMap, buckets, ramp } = useMemo(() => {
    const byState = new Map<number, { rows: SearchResult[]; name: string }>();

    for (const r of results) {
      const existing = byState.get(r.state_id);
      if (existing) {
        existing.rows.push(r);
      } else {
        byState.set(r.state_id, { rows: [r], name: r.state });
      }
    }

    const aggregated = new Map<string, StateAggregation>();

    for (const [stateId, { rows, name }] of byState) {
      let value: number;
      let bestMandi: string;
      let bestMandiPrice: number;

      if (metric === "price") {
        // Lowest modal_price = best deal
        const best = rows.reduce((min, r) =>
          r.modal_price < min.modal_price ? r : min
        );
        value = best.modal_price;
        bestMandi = best.mandi;
        bestMandiPrice = best.modal_price;
      } else {
        // Sum arrivals
        value = rows.reduce((sum, r) => sum + r.arrival_qty, 0);
        const best = rows.reduce((max, r) =>
          r.arrival_qty > max.arrival_qty ? r : max
        );
        bestMandi = best.mandi;
        bestMandiPrice = best.modal_price;
      }

      aggregated.set(normalizeStateName(name), {
        stateId,
        stateName: name,
        value,
        bestMandi,
        bestMandiPrice,
      });
    }

    const values = Array.from(aggregated.values()).map((a) => a.value);
    const bkts = computeQuantileBuckets(values);
    const colorRamp = metric === "price" ? PRICE_RAMP : ARRIVALS_RAMP;

    return { stateMap: aggregated, buckets: bkts, ramp: colorRamp };
  }, [results, metric]);

  /* ---- Track unmatched states (dev warning) ---- */
  const warnedRef = useMemo(() => new Set<string>(), []);

  /* ---- Tooltip handlers ---- */
  const handleMouseMove = useCallback(
    (
      event: React.MouseEvent,
      geoName: string,
      agg: StateAggregation | null
    ) => {
      const target = event.currentTarget as SVGElement;
      const svgRect = target.closest("svg")?.getBoundingClientRect();
      if (!svgRect) return;
      setTooltipInfo({
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top - 12,
        stateName: agg?.stateName ?? geoName,
        bestMandi: agg?.bestMandi ?? "—",
        modalPrice: agg?.bestMandiPrice ?? 0,
        value: agg?.value ?? 0,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredGeo(null);
    setTooltipInfo(null);
  }, []);

  /* ---- Render ---- */
  return (
    <div className="india-map-container relative">
      {/* SVG hatch pattern definition */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern
            id="nodata-hatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
      </svg>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 1000,
          center: [82, 22],
        }}
        width={500}
        height={560}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoName: string = String(geo.properties.NAME_1 ?? "");
              const agg = matchGeoNameToApiState(geoName, stateMap);

              // Dev warning for unmatched states that have data
              if (!agg && results.length > 0 && !warnedRef.has(geoName)) {
                // Only warn once per geo name per mount
                // Some states genuinely won't have data
              }

              const isHovered = hoveredGeo === geo.rsmKey;
              const isSelected =
                selectedStateId != null &&
                agg?.stateId === selectedStateId;

              let fill: string;
              let fillPattern = false;

              if (agg) {
                fill = getColorForQuantile(agg.value, buckets, ramp);
              } else {
                fill = "var(--color-surface-2)";
                fillPattern = true;
              }

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillPattern ? "url(#nodata-hatch)" : fill}
                  style={{
                    default: {
                      outline: "none",
                      stroke: isSelected
                        ? "var(--color-text)"
                        : "var(--color-border)",
                      strokeWidth: isSelected ? 2 : 0.5,
                      transition: "all 150ms ease-out",
                    },
                    hover: {
                      outline: "none",
                      stroke: "var(--color-text)",
                      strokeWidth: 2,
                      cursor: "pointer",
                    },
                    pressed: {
                      outline: "none",
                    },
                  }}
                  onMouseEnter={() => setHoveredGeo(geo.rsmKey)}
                  onMouseMove={(e) =>
                    handleMouseMove(
                      e as unknown as React.MouseEvent,
                      geoName,
                      agg
                    )
                  }
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    if (agg) {
                      onSelectState(
                        agg.stateId === selectedStateId
                          ? null
                          : agg.stateId
                      );
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip */}
      {tooltipInfo && (
        <div
          className="india-map-tooltip"
          style={{
            left: tooltipInfo.x,
            top: tooltipInfo.y,
          }}
        >
          <div className="font-semibold text-[13px] leading-[18px]">
            {tooltipInfo.stateName}
          </div>
          <div className="text-[12px] leading-[16px] text-text-muted mt-0.5">
            Best mandi: {tooltipInfo.bestMandi}
          </div>
          <div className="text-[12px] leading-[16px] tabular-nums mt-0.5">
            {metric === "price"
              ? `₹${formatIndianNumber(tooltipInfo.modalPrice)}/qtl`
              : `${formatIndianNumber(tooltipInfo.value)} qtl arrivals`}
          </div>
        </div>
      )}

      {/* Legend — always visible, per UI-DESIGN.md */}
      <div className="india-map-legend">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
          {metric === "price" ? "Modal Price (₹/qtl)" : "Arrivals (qtl)"}
        </div>
        {buckets.map((bucketMax, i) => {
          const bucketMin = i === 0 ? 0 : buckets[i - 1];
          const isFirst = i === 0;
          return (
            <div key={i} className="flex items-center gap-1.5 mb-0.5">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm border border-border shrink-0"
                style={{ backgroundColor: ramp[i] }}
              />
              <span className="text-[11px] leading-[14px] tabular-nums text-text-muted whitespace-nowrap">
                {isFirst
                  ? `≤ ${formatLegendValue(bucketMax, metric)}`
                  : `${formatLegendValue(bucketMin, metric)} – ${formatLegendValue(bucketMax, metric)}`}
              </span>
            </div>
          );
        })}
        {/* No data entry */}
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-border">
          <svg
            width="14"
            height="14"
            className="shrink-0 rounded-sm border border-border overflow-hidden"
          >
            <rect width="14" height="14" fill="var(--color-surface-2)" />
            <line
              x1="0"
              y1="14"
              x2="14"
              y2="0"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <line
              x1="0"
              y1="7"
              x2="7"
              y2="0"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <line
              x1="7"
              y1="14"
              x2="14"
              y2="7"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
          </svg>
          <span className="text-[11px] leading-[14px] text-text-muted">
            No data
          </span>
        </div>
      </div>
    </div>
  );
}

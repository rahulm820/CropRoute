"use client";

import { useMemo, useState } from "react";
import { SkeletonRow, EmptyState } from "@/components";

/* ------------------------------------------------------------------ */
/*  Types — matches GET /api/search response from docs/API.md          */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  mandi_id: number;
  mandi: string;
  state_id: number;
  state: string;
  lat: number;
  lng: number;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrival_qty: number;
  unit: string;
  trend_7d_pct: number;
  date: string; // "YYYY-MM-DD"
}

export interface SearchResponse {
  item: string;
  last_refreshed: string;
  results: SearchResult[];
}

interface RankedTableProps {
  /** The search response data, or null while loading. */
  data: SearchResponse | null;
  /** True while the API call is in flight. */
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Column definitions                                                 */
/* ------------------------------------------------------------------ */

type SortDirection = "asc" | "desc";

interface ColumnDef {
  key: string;
  label: string;
  /** Right-align numeric columns per UI-DESIGN.md */
  numeric: boolean;
  /** Accessor to get the sort-comparable value */
  getValue: (r: SearchResult) => string | number;
  /** Render the cell content */
  render: (r: SearchResult) => React.ReactNode;
}

/**
 * Format a "YYYY-MM-DD" date string into a locale-neutral display.
 * Uses UTC parsing to avoid server/client hydration mismatches
 * (same pattern ProvenanceChip uses — see PR #38 hydration fix).
 */
const UTC_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatDateDisplay(dateStr: string): string {
  // Parse as UTC-only to guarantee server = client
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);
  return `${day} ${UTC_MONTHS[month]} ${year}`;
}

/**
 * Format an integer with Indian-style grouping (lakhs/crores).
 * Per CLAUDE.md: "integers, never float" — display only.
 */
function formatIndianNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

const COLUMNS: ColumnDef[] = [
  {
    key: "state",
    label: "State",
    numeric: false,
    getValue: (r) => r.state,
    render: (r) => r.state,
  },
  {
    key: "mandi",
    label: "Mandi",
    numeric: false,
    getValue: (r) => r.mandi,
    render: (r) => r.mandi,
  },
  {
    key: "modal_price",
    label: "Modal Price (₹/qtl)",
    numeric: true,
    getValue: (r) => r.modal_price,
    render: (r) => (
      <span className="tabular-nums font-medium">
        ₹{formatIndianNumber(Math.round(r.modal_price))}
      </span>
    ),
  },
  {
    key: "arrivals",
    label: "Arrivals (qtl)",
    numeric: true,
    getValue: (r) => r.arrival_qty,
    render: (r) => (
      <span className="tabular-nums">
        {formatIndianNumber(Math.round(r.arrival_qty))}
      </span>
    ),
  },
  {
    key: "date",
    label: "Last Updated",
    numeric: false,
    getValue: (r) => r.date,
    render: (r) => (
      <span className="text-text-muted">{formatDateDisplay(r.date)}</span>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Sort arrow icon                                                    */
/* ------------------------------------------------------------------ */

function SortArrow({ direction }: { direction: SortDirection | null }) {
  if (!direction) {
    // Neutral indicator — subtle double arrow
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="ml-1 inline-block opacity-30"
      >
        <polyline points="3,5 6,2 9,5" />
        <polyline points="3,7 6,10 9,7" />
      </svg>
    );
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ml-1 inline-block text-brand"
    >
      {direction === "asc" ? (
        <polyline points="3,8 6,3 9,8" />
      ) : (
        <polyline points="3,4 6,9 9,4" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state icon                                                   */
/* ------------------------------------------------------------------ */

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
/*  RankedTable                                                        */
/* ------------------------------------------------------------------ */

export default function RankedTable({ data, loading = false }: RankedTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  /* ---- Toggle sort on column click ---- */
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ---- Sorted results (client-side only, no refetch) ---- */
  const sortedResults = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data.results;

    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return data.results;

    const sorted = [...data.results].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc"
        ? sa.localeCompare(sb)
        : sb.localeCompare(sa);
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  /* ---- Loading state: skeleton rows ---- */
  if (loading) {
    return (
      <div className="w-full overflow-x-auto border border-border rounded-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-3 py-3
                    text-[12px] leading-[16px] font-semibold uppercase tracking-wide
                    text-text-muted
                    border-b border-border
                    ${col.numeric ? "text-right" : "text-left"}
                  `}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} columns={COLUMNS.length} height={48} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---- Empty state ---- */
  if (data && data.results.length === 0) {
    return (
      <EmptyState
        icon={<SearchIcon />}
        message={`No results for "${data.item}" — try a different commodity`}
      />
    );
  }

  /* ---- No data yet (shouldn't happen when used correctly) ---- */
  if (!data) return null;

  /* ---- Data table ---- */
  return (
    <div className="w-full overflow-x-auto border border-border rounded-card">
      <table className="w-full border-collapse" role="grid">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-2">
            {COLUMNS.map((col) => {
              const isActive = sortKey === col.key;
              const currentDir = isActive ? sortDir : null;
              return (
                <th
                  key={col.key}
                  className={`
                    px-3 py-3
                    text-[12px] leading-[16px] font-semibold uppercase tracking-wide
                    text-text-muted
                    border-b border-border
                    ${col.numeric ? "text-right" : "text-left"}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    aria-label={`Sort by ${col.label}${
                      isActive
                        ? sortDir === "asc"
                          ? ", currently ascending"
                          : ", currently descending"
                        : ""
                    }`}
                    className={`
                      inline-flex items-center gap-0
                      bg-transparent border-none cursor-pointer
                      text-[12px] leading-[16px] font-semibold uppercase tracking-wide
                      transition-colors duration-150 ease-out
                      rounded px-1 -mx-1 py-0.5
                      focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface-2
                      ${isActive ? "text-brand" : "text-text-muted hover:text-text"}
                    `}
                  >
                    {col.label}
                    <SortArrow direction={currentDir} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedResults.map((result) => (
            <tr
              key={`${result.state_id}-${result.mandi_id}`}
              className="
                bg-surface
                transition-colors duration-150 ease-out
                hover:bg-brand-soft
              "
            >
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className={`
                    px-3 py-3
                    text-[14px] leading-[20px] font-medium
                    border-b border-border
                    ${col.numeric ? "text-right" : "text-left"}
                  `}
                >
                  {col.render(result)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

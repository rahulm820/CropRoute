"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import StatusPill from "./StatusPill";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import type {
  CollectorStatus,
  CollectorRunEntry,
} from "@/lib/mocks/collectorStatus";

// ── Mock switch ────────────────────────────────────────────────────────
// Remove once backend collectors endpoint ships (issue TBD).
// When true, the panel uses the fixture instead of hitting the API.
const USE_MOCK_COLLECTORS = true;
// ───────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 7_000;

type CollectorStatusType = CollectorStatus["status"];

/** Ring color CSS variable per status — drives the transition animation. */
const ringColorVar: Record<CollectorStatusType, string> = {
  healthy: "var(--color-ok)",
  broken: "var(--color-danger)",
  self_healed: "var(--color-warn)",
  failed: "var(--color-danger)",
};

/** Completeness bar color class by threshold. */
function completenessColor(value: number): string {
  if (value >= 0.8) return "bg-ok";
  if (value >= 0.5) return "bg-warn";
  return "bg-danger";
}

/** Format an ISO timestamp as a short relative/absolute label. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const day = d.getUTCDate();
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  return `${day} ${months[d.getUTCMonth()]}`;
}

/** Sort runs by ran_at descending (most recent first). Unconditional. */
function sortRunsDesc(runs: CollectorRunEntry[]): CollectorRunEntry[] {
  return [...runs].sort(
    (a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime()
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="collector-skeleton-card space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer collector-skeleton-bar w-1/3" />
        <div className="skeleton-shimmer collector-skeleton-bar w-20" />
      </div>
      <div className="skeleton-shimmer collector-skeleton-bar w-2/3" />
      <div className="space-y-2">
        <div className="skeleton-shimmer collector-skeleton-bar w-full" />
        <div className="skeleton-shimmer collector-skeleton-bar w-1/2" />
      </div>
    </div>
  );
}

// ── Timeline row ───────────────────────────────────────────────────────

function TimelineRow({ run }: { run: CollectorRunEntry }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-b-0">
      {/* Vertical timeline dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={`w-2 h-2 rounded-full ${
            run.status === "healthy"
              ? "bg-ok"
              : run.status === "self_healed"
              ? "bg-warn"
              : "bg-danger"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={run.status} size="sm" />
          <span className="text-[12px] leading-[16px] text-text-muted tabular-nums">
            {formatTimestamp(run.ran_at)}
          </span>
        </div>

        {run.notes && (
          <p className="text-[14px] leading-[20px] text-text break-words whitespace-pre-wrap">
            {run.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Collector card ─────────────────────────────────────────────────────

function CollectorCard({
  collector,
  prevStatus,
}: {
  collector: CollectorStatus;
  prevStatus: CollectorStatusType | null;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const sortedRuns = sortRunsDesc(collector.runs);

  // Detect status change → trigger ring animation
  const statusChanged =
    prevStatus !== null && prevStatus !== collector.status;

  // Generate a unique key per status+last_run to re-mount animation wrapper
  const animKey = `${collector.status}-${collector.last_run}`;

  const isFailed = collector.status === "failed";
  const pct = Math.round(collector.field_completeness * 100);

  return (
    <div
      key={animKey}
      className={`
        bg-surface border border-border rounded-card shadow-card
        p-card-padding space-y-4
        transition-shadow duration-150 ease-out
        ${isFailed ? "collector-card-failed" : ""}
        ${statusChanged ? "collector-card-transition" : ""}
      `}
      style={
        statusChanged
          ? ({ "--ring-color": ringColorVar[collector.status] } as React.CSSProperties)
          : undefined
      }
      id={`collector-card-${collector.collector}`}
    >
      {/* ── Header: name + large status badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="text-[16px] leading-[22px] font-semibold text-text truncate">
            {collector.collector}
          </h3>
          <div className="flex items-center gap-1.5 text-[12px] leading-[16px] text-text-muted">
            <span>{collector.target_state}</span>
            <span className="text-border">·</span>
            <a
              href={collector.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-strong truncate transition-colors duration-150"
            >
              {(() => {
                try {
                  return new URL(collector.target_url).hostname.replace(
                    /^www\./,
                    ""
                  );
                } catch {
                  return collector.target_url;
                }
              })()}
            </a>
          </div>
        </div>

        <StatusPill status={collector.status} size="lg" />
      </div>

      {/* ── Failed notice ── */}
      {isFailed && (
        <p className="text-[12px] leading-[16px] text-danger font-medium">
          Needs manual intervention
        </p>
      )}

      {/* ── Completeness bar ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] leading-[16px] text-text-muted">
            Field completeness
          </span>
          <span
            className={`text-[12px] leading-[16px] font-medium tabular-nums ${
              pct >= 80
                ? "text-ok"
                : pct >= 50
                ? "text-warn"
                : "text-danger"
            }`}
          >
            {pct}%
          </span>
        </div>
        <div className="completeness-bar-track">
          <div
            className={`completeness-bar-fill ${completenessColor(
              collector.field_completeness
            )}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Last run timestamp ── */}
      <div className="text-[12px] leading-[16px] text-text-muted">
        Last run:{" "}
        <span className="tabular-nums">{formatTimestamp(collector.last_run)}</span>
      </div>

      {/* ── Timeline accordion ── */}
      {sortedRuns.length > 0 && (
        <div className="border-t border-border pt-3 -mx-card-padding px-card-padding">
          <button
            type="button"
            onClick={() => setTimelineOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 w-full text-left
              text-[13px] leading-[18px] font-medium text-brand
              hover:text-brand-strong
              bg-transparent border-none cursor-pointer p-0
              transition-colors duration-150 ease-out
              focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
            "
            aria-expanded={timelineOpen}
            id={`timeline-toggle-${collector.collector}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-150 ${
                timelineOpen ? "rotate-90" : ""
              }`}
              aria-hidden="true"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            Run history ({sortedRuns.length})
          </button>

          <div
            className="timeline-accordion"
            data-open={timelineOpen ? "true" : "false"}
          >
            <div className="timeline-accordion-inner">
              <div className="pt-3 space-y-0">
                {sortedRuns.map((run, i) => (
                  <TimelineRow key={`${run.ran_at}-${i}`} run={run} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────

export default function SelfHealPanel() {
  const [collectors, setCollectors] = useState<CollectorStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track previous statuses for transition animation
  const prevStatusRef = useRef<Record<string, CollectorStatusType>>({});

  const fetchCollectors = useCallback(async () => {
    try {
      let data: CollectorStatus[];

      if (USE_MOCK_COLLECTORS) {
        // Dynamic import keeps the fixture out of production bundles
        // when USE_MOCK_COLLECTORS is flipped to false / removed.
        const { MOCK_COLLECTORS } = await import(
          "@/lib/mocks/collectorStatus"
        );
        data = MOCK_COLLECTORS;
      } else {
        data = await apiFetch<CollectorStatus[]>("/api/collectors/status");
      }

      // Only update state if data has actually changed (prevent flicker)
      setCollectors((prev) => {
        const prevJson = prev ? JSON.stringify(prev) : null;
        const nextJson = JSON.stringify(data);
        if (prevJson === nextJson) return prev;

        // Capture previous statuses for transition detection
        if (prev) {
          const map: Record<string, CollectorStatusType> = {};
          for (const c of prev) {
            map[c.collector] = c.status;
          }
          prevStatusRef.current = map;
        }

        return data;
      });

      setError(null);
    } catch (err) {
      // On error, keep showing the last good data if available
      if (!collectors) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch collector status"
        );
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCollectors();
    const id = setInterval(fetchCollectors, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCollectors]);

  // ── Loading state ──
  if (loading && !collectors) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-section-gap"
        aria-busy="true"
        aria-label="Loading collector status"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // ── Error state (no data at all) ──
  if (error && !collectors) {
    return (
      <ErrorState
        message="Collector status unavailable"
        fallback="Other pages remain functional"
      />
    );
  }

  // ── Empty state ──
  if (collectors && collectors.length === 0) {
    return (
      <EmptyState
        icon={
          <svg
            width="32"
            height="32"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 5v3M8 10.5h.01" />
          </svg>
        }
        message="No collectors registered yet — configure a scraper in scrapers/ to get started."
      />
    );
  }

  // ── Data grid ──
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-section-gap"
      role="region"
      aria-label="Collector status overview"
    >
      {collectors!.map((c) => (
        <CollectorCard
          key={c.collector}
          collector={c}
          prevStatus={prevStatusRef.current[c.collector] ?? null}
        />
      ))}
    </div>
  );
}

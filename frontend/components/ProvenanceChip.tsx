"use client";

import { useEffect, useMemo, useState } from "react";

interface ProvenanceChipProps {
  sourceUrl: string;
  scrapedAt: string | null;
  collectorName: string;
}

/**
 * Extract the domain from a URL for display.
 * Falls back to the raw string if parsing fails.
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type FreshnessTier = "fresh" | "dated" | "stale" | "unverified";

/**
 * Format a UTC date as "d Mon" (e.g. "17 Aug") using UTC methods
 * so server and client always agree regardless of timezone.
 */
const UTC_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatDateUTC(d: Date): string {
  return `${d.getUTCDate()} ${UTC_MONTHS[d.getUTCMonth()]}`;
}

/**
 * Determine freshness tier and display text from an ISO timestamp.
 * Uses an explicit `now` reference so caller controls the clock.
 */
function getFreshness(
  scrapedAt: string | null,
  now: Date,
): { tier: FreshnessTier; label: string } {
  if (!scrapedAt) {
    return { tier: "unverified", label: "unverified source" };
  }

  const scraped = new Date(scrapedAt);
  const diffMs = now.getTime() - scraped.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return { tier: "fresh", label: `verified ${mins}m ago` };
  }

  if (diffHours < 24) {
    return {
      tier: "fresh",
      label: `verified ${Math.floor(diffHours)}h ago`,
    };
  }

  const dateStr = formatDateUTC(scraped);

  if (diffDays <= 7) {
    return { tier: "dated", label: `on ${dateStr}` };
  }

  return { tier: "stale", label: `on ${dateStr} · stale` };
}

/** Color classes per freshness tier. */
const tierStyles: Record<FreshnessTier, string> = {
  fresh: "text-text-muted",
  dated: "text-text-muted",
  stale: "text-warn",
  unverified: "text-danger",
};

/**
 * SSR-safe placeholder label — deterministic and timezone-independent.
 * For `null` scrapedAt we can render the final text immediately (no clock dependency).
 * For non-null scrapedAt we show the domain only; the freshness text appears after mount.
 */
function getSSRFreshness(scrapedAt: string | null): {
  tier: FreshnessTier;
  label: string;
} {
  if (!scrapedAt) {
    return { tier: "unverified", label: "unverified source" };
  }
  // Placeholder — replaced after mount with the real relative time
  return { tier: "dated", label: "…" };
}

/**
 * ProvenanceChip — the signature component.
 *
 * Every value from a scrape or external API renders one.
 * Format: [globe icon] {domain} · {freshness}
 * Pill shape, 12px, surface-2 bg, links to source in new tab.
 * Tooltip shows exact ISO timestamp + collector name.
 *
 * The freshness label is computed client-side only (useEffect) to avoid
 * hydration mismatches caused by server/client clock or timezone differences.
 */
export default function ProvenanceChip({
  sourceUrl,
  scrapedAt,
  collectorName,
}: ProvenanceChipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const domain = useMemo(() => extractDomain(sourceUrl), [sourceUrl]);

  // SSR-safe initial value — no clock dependency
  const ssrFreshness = useMemo(() => getSSRFreshness(scrapedAt), [scrapedAt]);

  // After mount, compute the real freshness label using the client clock
  const [freshness, setFreshness] = useState(ssrFreshness);

  useEffect(() => {
    // scrapedAt === null case is already final from SSR
    if (!scrapedAt) return;
    setFreshness(getFreshness(scrapedAt, new Date()));
  }, [scrapedAt]);

  const tooltipText = scrapedAt
    ? `${scrapedAt}\nCollector: ${collectorName}`
    : `No timestamp\nCollector: ${collectorName}`;

  return (
    <span className="relative inline-flex">
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          inline-flex items-center gap-1 px-2 py-0.5
          bg-surface-2 rounded-pill
          text-[12px] leading-[16px] font-normal
          no-underline
          transition-colors duration-150 ease-out
          ${tierStyles[freshness.tier]}
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {/* Globe icon — simple inline SVG, no dependency */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="8" cy="8" r="6.5" />
          <ellipse cx="8" cy="8" rx="3" ry="6.5" />
          <line x1="1.5" y1="8" x2="14.5" y2="8" />
        </svg>

        <span suppressHydrationWarning>
          {domain} · {freshness.label}
        </span>
      </a>

      {/* Tooltip */}
      {showTooltip && (
        <span
          role="tooltip"
          className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
            bg-text text-bg
            text-[11px] leading-[14px] font-normal
            px-2 py-1 rounded whitespace-pre
            pointer-events-none z-50
          "
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}


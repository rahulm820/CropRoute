/**
 * TrendDelta — signed percentage with a directional arrow.
 *
 * Per UI-DESIGN.md's component inventory:
 * - Up = accent token, Down = brand token
 * - Never red/green — colors are neutral direction indicators, not value
 *   judgments (a price drop is good for a buyer, bad for a farmer)
 * - Tabular-nums for numeric stability
 *
 * If value is null/undefined/NaN the component renders nothing — the
 * parent is responsible for showing an appropriate fallback (e.g. "—").
 */

interface TrendDeltaProps {
  /** Signed percentage value. Null/undefined/NaN = no valid delta. */
  value: number | null | undefined;
  /**
   * Accessible label for screen readers.
   * Falls back to a generated label like "increased by 4.2 percent".
   */
  ariaLabel?: string;
}

export default function TrendDelta({ value, ariaLabel }: TrendDeltaProps) {
  // Defensive: reject null, undefined, NaN — parent must handle the fallback
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const isUp = value > 0;
  const isDown = value < 0;
  const isFlat = value === 0;

  // Format: always show sign, one decimal place
  const formatted = `${isUp ? "+" : ""}${value.toFixed(1)}%`;

  // Color mapping per UI-DESIGN.md:
  // up = accent (amber), down = brand (green), flat = text-muted
  const colorClass = isUp
    ? "text-accent"
    : isDown
    ? "text-brand"
    : "text-text-muted";

  // Generate accessible label if not provided
  const computedAriaLabel =
    ariaLabel ??
    (isFlat
      ? "no change"
      : `${isUp ? "increased" : "decreased"} by ${Math.abs(value).toFixed(1)} percent`);

  return (
    <span
      className={`trend-delta ${colorClass}`}
      role="img"
      aria-label={computedAriaLabel}
    >
      {/* Directional arrow — up, down, or flat dash */}
      {!isFlat && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="trend-delta-arrow"
        >
          {isUp ? (
            <>
              <line x1="8" y1="12" x2="8" y2="4" />
              <polyline points="4,7 8,3 12,7" />
            </>
          ) : (
            <>
              <line x1="8" y1="4" x2="8" y2="12" />
              <polyline points="4,9 8,13 12,9" />
            </>
          )}
        </svg>
      )}
      <span className="tabular-nums">{formatted}</span>
    </span>
  );
}

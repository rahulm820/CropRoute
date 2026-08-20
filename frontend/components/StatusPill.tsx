type Status = "healthy" | "broken" | "self_healed" | "stale";

interface StatusPillProps {
  status: Status;
}

/**
 * Status config: color token class, icon SVG path, and display label.
 * Status is never color-only — always icon plus text (accessibility).
 */
const statusConfig: Record<
  Status,
  { colorClass: string; label: string; iconPath: string }
> = {
  healthy: {
    colorClass: "text-ok",
    label: "Healthy",
    // Checkmark circle
    iconPath: "M5 8.5l2.5 2.5L11 6",
  },
  broken: {
    colorClass: "text-danger",
    label: "Broken",
    // X mark
    iconPath: "M5.5 5.5l5 5M10.5 5.5l-5 5",
  },
  self_healed: {
    colorClass: "text-warn",
    label: "Self-healed",
    // Refresh/arrow circle
    iconPath: "M11.5 4.5a5 5 0 1 0 .5 5.5M12 3v3h-3",
  },
  stale: {
    colorClass: "text-warn",
    label: "Stale",
    // Clock
    iconPath: "M8 4.5V8l2.5 1.5",
  },
};

/**
 * StatusPill — healthy / broken / self_healed / stale.
 *
 * Always renders icon + text together, never color alone.
 * Matches collector_runs status values and ok/warn/danger tokens.
 */
export default function StatusPill({ status }: StatusPillProps) {
  const { colorClass, label, iconPath } = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        bg-surface-2 rounded-pill
        text-[12px] leading-[16px] font-medium
        ${colorClass}
      `}
    >
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
        {status === "broken" || status === "self_healed" ? (
          <>
            {status === "broken" && (
              <circle cx="8" cy="8" r="6.5" />
            )}
            <path d={iconPath} />
          </>
        ) : status === "stale" ? (
          <>
            <circle cx="8" cy="8" r="6.5" />
            <path d={iconPath} />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="6.5" />
            <path d={iconPath} />
          </>
        )}
      </svg>
      {label}
    </span>
  );
}

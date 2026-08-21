type Status = "healthy" | "broken" | "self_healed" | "failed" | "stale";

interface StatusPillProps {
  status: Status;
  /** "sm" (default) for inline use, "lg" for projector-readable cards. */
  size?: "sm" | "lg";
}

/**
 * Status config: color token class, icon SVG path, and display label.
 * Status is never color-only — always icon plus text (accessibility).
 *
 * `failed` uses a warning-triangle icon (structurally distinct from
 * broken's circle-X) so shape alone distinguishes them without color.
 */
const statusConfig: Record<
  Status,
  { colorClass: string; bgClass: string; label: string; iconPath: string; useTriangle?: boolean }
> = {
  healthy: {
    colorClass: "text-ok",
    bgClass: "bg-surface-2",
    label: "Healthy",
    // Checkmark circle
    iconPath: "M5 8.5l2.5 2.5L11 6",
  },
  broken: {
    colorClass: "text-danger",
    bgClass: "bg-surface-2",
    label: "Broken",
    // X mark inside circle
    iconPath: "M5.5 5.5l5 5M10.5 5.5l-5 5",
  },
  self_healed: {
    colorClass: "text-warn",
    bgClass: "bg-surface-2",
    label: "Self-healed",
    // Refresh/arrow circle
    iconPath: "M11.5 4.5a5 5 0 1 0 .5 5.5M12 3v3h-3",
  },
  failed: {
    colorClass: "text-danger",
    bgClass: "bg-danger/10",
    label: "Failed",
    // Warning triangle with exclamation — distinct shape from broken's circle
    iconPath: "M8 6v3M8 11h.01",
    useTriangle: true,
  },
  stale: {
    colorClass: "text-warn",
    bgClass: "bg-surface-2",
    label: "Stale",
    // Clock
    iconPath: "M8 4.5V8l2.5 1.5",
  },
};

const sizeClasses = {
  sm: {
    pill: "px-2 py-0.5 text-[12px] leading-[16px] gap-1",
    icon: 12,
  },
  lg: {
    pill: "px-3 py-1 text-[16px] leading-[22px] gap-1.5 font-semibold",
    icon: 20,
  },
} as const;

/**
 * StatusPill — healthy / broken / self_healed / failed / stale.
 *
 * Always renders icon + text together, never color alone.
 * Matches collector_runs status values and ok/warn/danger tokens.
 *
 * `failed` renders a warning-triangle (△!) — structurally different from
 * broken's circle-X (⊗) so a colorblind viewer reads the shape, not just color.
 */
export default function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const { colorClass, bgClass, label, iconPath, useTriangle } = statusConfig[status];
  const s = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center rounded-pill font-medium
        ${s.pill} ${bgClass} ${colorClass}
      `}
    >
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        {useTriangle ? (
          <>
            {/* Warning triangle outline */}
            <path d="M8 2L1.5 13.5h13L8 2z" />
            <path d={iconPath} />
          </>
        ) : status === "self_healed" ? (
          <path d={iconPath} />
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

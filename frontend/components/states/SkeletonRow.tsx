interface SkeletonRowProps {
  /** Number of cells to render in the row. */
  columns: number;
  /** Optional fixed height in px to match the real row exactly and prevent layout shift. */
  height?: number;
}

/**
 * SkeletonRow — loading placeholder for table rows.
 *
 * Shimmer animation at 1.2s per spec. Accepts `columns` prop to match
 * final row structure. Uses prefers-reduced-motion to disable animation.
 */
export default function SkeletonRow({
  columns,
  height = 44,
}: SkeletonRowProps) {
  return (
    <tr style={{ height: `${height}px` }} aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-3 py-2">
          <div
            className="
              h-3 rounded bg-surface-2
              skeleton-shimmer
            "
            style={{
              /* Vary widths so the skeleton looks like real data */
              width: i === 0 ? "60%" : i === columns - 1 ? "40%" : "70%",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

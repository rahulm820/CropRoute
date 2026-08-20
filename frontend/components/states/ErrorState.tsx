interface ErrorStateProps {
  /** What failed — e.g. "News unavailable". */
  message: string;
  /** What still works — e.g. "prices are current". Communicates that a failed
   *  section doesn't take down its neighbours. */
  fallback?: string;
}

/**
 * ErrorState — what failed and what still works.
 *
 * "News unavailable, prices are current" — a failed card must never blank
 * its neighbours.
 */
export default function ErrorState({ message, fallback }: ErrorStateProps) {
  return (
    <div className="flex items-start gap-2 py-6 px-4">
      {/* Error icon — circle with exclamation mark */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-danger mt-0.5"
      >
        <circle cx="8" cy="8" r="6.5" />
        <line x1="8" y1="5" x2="8" y2="8.5" />
        <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
      </svg>

      <div>
        <p className="text-[14px] leading-[20px] text-danger font-medium">
          {message}
        </p>
        {fallback && (
          <p className="text-[12px] leading-[16px] text-text-muted mt-0.5">
            {fallback}
          </p>
        )}
      </div>
    </div>
  );
}

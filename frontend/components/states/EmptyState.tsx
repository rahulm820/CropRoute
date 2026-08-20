import { ReactNode } from "react";

interface EmptyStateProps {
  /** Icon element (SVG or similar) to render above the message. */
  icon: ReactNode;
  /** One-line cause describing why there's no data — never just "No data". */
  message: string;
  /** Optional action: label + onClick callback or href link. */
  action?: {
    label: string;
  } & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });
}

/**
 * EmptyState — cause plus an action.
 *
 * "No news scraped for Punjab yet — run the collector"
 * Never a bare "No data" — always states the cause and suggests an action.
 */
export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-text-muted mb-3">{icon}</div>

      <p className="text-[14px] leading-[20px] text-text-muted max-w-sm">
        {message}
      </p>

      {action && (
        <div className="mt-4">
          {action.href ? (
            <a
              href={action.href}
              className="
                inline-flex items-center gap-1
                text-[13px] leading-[18px] font-medium
                text-brand hover:text-brand-strong
                transition-colors duration-150 ease-out
                underline underline-offset-2
              "
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="
                inline-flex items-center gap-1
                text-[13px] leading-[18px] font-medium
                text-brand hover:text-brand-strong
                transition-colors duration-150 ease-out
                underline underline-offset-2
                bg-transparent border-none cursor-pointer
              "
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

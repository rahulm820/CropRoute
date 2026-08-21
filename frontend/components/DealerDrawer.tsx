"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import ProvenanceChip from "./ProvenanceChip";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import type { MandiDetailResponse } from "@/lib/mocks/mandiDetail";

// ── Mock switch ────────────────────────────────────────────────────────
// Remove once backend enrichment endpoint ships (issue #17).
// When true, the drawer uses the fixture instead of hitting the API.
const USE_MOCK_MANDI_DETAIL = true;
// ───────────────────────────────────────────────────────────────────────

/* ------------------------------------------------------------------ */
/*  Phone icon (inline SVG, no dependency)                             */
/* ------------------------------------------------------------------ */

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M1.5 2.5C1.5 2.5 3 1.5 4 1.5C5 1.5 5.5 3 5.5 3L4.5 5.5C4.5 5.5 6.5 8.5 8 10C9.5 11.5 10.5 11.5 10.5 11.5L13 10.5C13 10.5 14.5 11 14.5 12C14.5 13 13.5 14.5 13.5 14.5C12 15.5 9 15 6.5 12.5C4 10 3 8 2 5.5C1 3 1.5 2.5 1.5 2.5Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Office icon (building)                                             */
/* ------------------------------------------------------------------ */

function OfficeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="3" width="12" height="12" rx="1" />
      <line x1="6" y1="15" x2="6" y2="11" />
      <line x1="10" y1="15" x2="10" y2="11" />
      <line x1="5" y1="6" x2="7" y2="6" />
      <line x1="9" y1="6" x2="11" y2="6" />
      <line x1="5" y1="9" x2="7" y2="9" />
      <line x1="9" y1="9" x2="11" y2="9" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Person icon (dealer)                                               */
/* ------------------------------------------------------------------ */

function PersonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="8" cy="5" r="3" />
      <path d="M2.5 15C2.5 11.5 4.5 9.5 8 9.5C11.5 9.5 13.5 11.5 13.5 15" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Close icon (X)                                                     */
/* ------------------------------------------------------------------ */

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="4" x2="14" y2="14" />
      <line x1="14" y1="4" x2="4" y2="14" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton rows for loading state                                    */
/* ------------------------------------------------------------------ */

function DrawerSkeleton({ state }: { state: string }) {
  return (
    <div className="space-y-6" aria-busy="true">
      {/* Loading message — named source per UI-DESIGN.md States */}
      <div className="flex items-center gap-3 py-2">
        <div className="dealer-drawer-pulse-dot" />
        <p className="text-[13px] leading-[18px] text-text-muted">
          Fetching contacts from the {state} APMC portal…
        </p>
      </div>

      {/* Office skeleton */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-3 w-24 rounded-full" />
        <div className="space-y-2 border border-border rounded-card p-4">
          <div className="skeleton-shimmer h-3 w-3/4 rounded-full" />
          <div className="skeleton-shimmer h-3 w-1/2 rounded-full" />
          <div className="skeleton-shimmer h-3 w-1/3 rounded-full" />
        </div>
      </div>

      {/* Dealer skeletons */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-3 w-20 rounded-full" />
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="space-y-2 border border-border rounded-card p-4"
          >
            <div className="skeleton-shimmer h-3 w-2/3 rounded-full" />
            <div className="skeleton-shimmer h-3 w-1/3 rounded-full" />
            <div className="skeleton-shimmer h-3 w-1/4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty-dealers notice icon                                          */
/* ------------------------------------------------------------------ */

function InfoIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  DealerDrawer                                                       */
/* ------------------------------------------------------------------ */

export default function DealerDrawer({ mandiId, onClose }: {
  /** The mandi ID to fetch details for. Null means the drawer is closed. */
  mandiId: string | null;
  /** Callback to close the drawer. */
  onClose: () => void;
}) {
  const [data, setData] = useState<MandiDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for focus management
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const isOpen = mandiId !== null;

  /* ---- Fetch mandi detail ---- */
  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let result: MandiDetailResponse;

      if (USE_MOCK_MANDI_DETAIL) {
        // Dynamic import keeps the fixture out of production bundles
        const { getMockMandiDetail } = await import(
          "@/lib/mocks/mandiDetail"
        );
        // Simulate network latency for realistic loading state
        await new Promise((resolve) => setTimeout(resolve, 800));
        const mockData = getMockMandiDetail(id);
        if (!mockData) throw new Error("Mandi not found");
        result = mockData;
      } else {
        result = await apiFetch<MandiDetailResponse>(`/api/mandi/${id}`);
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch mandi details"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Fetch when mandiId changes ---- */
  useEffect(() => {
    if (mandiId) {
      fetchDetail(mandiId);
    } else {
      setData(null);
      setError(null);
    }
  }, [mandiId, fetchDetail]);

  /* ---- Focus management: move focus into drawer on open ---- */
  useEffect(() => {
    if (isOpen) {
      // Remember what was focused before the drawer opened
      triggerRef.current = document.activeElement;
      // Focus the close button after the transition starts
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else {
      // Return focus to the triggering element on close
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen]);

  /* ---- Escape key closes the drawer ---- */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  /* ---- Trap focus inside drawer ---- */
  useEffect(() => {
    if (!isOpen) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusableEls = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  /* ---- Derive state name for loading message ---- */
  const stateName = data?.mandi.state ?? "state";

  /* ---- Determine if genuinely empty (both office and dealers) ---- */
  const isGenuinelyEmpty =
    data && !data.office && data.dealers.length === 0;

  /* ---- Has office but no dealers (image-based table edge case) ---- */
  const hasOfficeNoDealers =
    data && data.office && data.dealers.length === 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`dealer-drawer-backdrop ${isOpen ? "dealer-drawer-backdrop-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={
          data ? `Contacts for ${data.mandi.name} mandi` : "Mandi contacts"
        }
        className={`dealer-drawer ${isOpen ? "dealer-drawer-open" : ""}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-[20px] leading-[26px] font-semibold text-text truncate">
              {data ? data.mandi.name : "Mandi"} Contacts
            </h2>
            {data && (
              <p className="text-[12px] leading-[16px] text-text-muted mt-1">
                {data.mandi.state}
                {data.enrichment.status === "stale" && (
                  <span className="text-warn ml-2">· enrichment stale</span>
                )}
              </p>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="
              shrink-0 p-1 -m-1 rounded
              text-text-muted hover:text-text
              transition-colors duration-150 ease-out
              focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
            "
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 min-h-0">
          {/* ── Loading state ── */}
          {loading && (
            <DrawerSkeleton state={stateName} />
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <ErrorState
              message="Could not load mandi contacts"
              fallback={error}
            />
          )}

          {/* ── Genuinely empty state ── */}
          {isGenuinelyEmpty && !loading && (
            <EmptyState
              icon={<InfoIcon />}
              message={`No contact information available for ${data.mandi.name} — this mandi's portal may require manual lookup`}
            />
          )}

          {/* ── Data state ── */}
          {data && !loading && !isGenuinelyEmpty && (
            <>
              {/* Office contact */}
              {data.office && (
                <section>
                  <h3 className="text-[12px] leading-[16px] font-semibold uppercase tracking-wide text-text-muted mb-3">
                    Market Committee Office
                  </h3>
                  <div className="border border-border rounded-card p-4 space-y-3 bg-surface">
                    <div className="flex items-start gap-2">
                      <OfficeIcon />
                      <p className="text-[14px] leading-[20px] text-text">
                        {data.office.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <PhoneIcon />
                      <a
                        href={`tel:${data.office.phone}`}
                        className="
                          text-[14px] leading-[20px] font-medium text-brand
                          hover:text-brand-strong
                          transition-colors duration-150 ease-out
                          underline underline-offset-2
                          focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
                          rounded
                        "
                      >
                        {data.office.phone}
                      </a>
                    </div>

                    <div className="pt-1">
                      <ProvenanceChip
                        sourceUrl={data.office.source_url}
                        scrapedAt={data.office.scraped_at}
                        collectorName={data.enrichment.collector}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Dealers list */}
              {data.dealers.length > 0 && (
                <section>
                  <h3 className="text-[12px] leading-[16px] font-semibold uppercase tracking-wide text-text-muted mb-3">
                    Registered Dealers ({data.dealers.length})
                  </h3>
                  <div className="space-y-3">
                    {data.dealers.map((dealer, i) => (
                      <div
                        key={`${dealer.name}-${i}`}
                        className="border border-border rounded-card p-4 space-y-3 bg-surface"
                      >
                        <div className="flex items-start gap-2">
                          <PersonIcon />
                          <div className="min-w-0">
                            <p className="text-[14px] leading-[20px] font-medium text-text truncate">
                              {dealer.name}
                            </p>
                            <p className="text-[12px] leading-[16px] text-text-muted capitalize">
                              {dealer.role}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <PhoneIcon />
                          <a
                            href={`tel:${dealer.phone}`}
                            className="
                              text-[14px] leading-[20px] font-medium text-brand
                              hover:text-brand-strong
                              transition-colors duration-150 ease-out
                              underline underline-offset-2
                              focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
                              rounded
                            "
                          >
                            {dealer.phone}
                          </a>
                        </div>

                        <div className="pt-1">
                          <ProvenanceChip
                            sourceUrl={dealer.source_url}
                            scrapedAt={dealer.scraped_at}
                            collectorName={data.enrichment.collector}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Notice when office exists but no dealers (image-based table) */}
              {hasOfficeNoDealers && (
                <div className="border border-border rounded-card p-4 bg-surface-2">
                  <div className="flex items-start gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="shrink-0 text-warn mt-0.5"
                    >
                      <circle cx="8" cy="8" r="6.5" />
                      <line x1="8" y1="5" x2="8" y2="8.5" />
                      <circle
                        cx="8"
                        cy="11"
                        r="0.5"
                        fill="currentColor"
                        stroke="none"
                      />
                    </svg>
                    <p className="text-[13px] leading-[18px] text-text-muted">
                      Individual dealer contacts are not available — this
                      portal publishes contact details as images, which
                      cannot be extracted automatically. Use the office phone
                      above for enquiries.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ================================================================== */
/*  Self-Heal Demo — the signature scroll-triggered moment             */
/*  Shows a mini collector card cycling through:                       */
/*  healthy → broken → self_healed                                     */
/*  Reuses StatusPill's actual colors and icon shapes.                 */
/* ================================================================== */

type HealPhase = "healthy" | "broken" | "self_healed";

const HEAL_PHASES: { phase: HealPhase; label: string; note: string }[] = [
  {
    phase: "healthy",
    label: "Healthy",
    note: "All 41 rows complete — baseline 0.95",
  },
  {
    phase: "broken",
    label: "Broken",
    note: "office_phone empty in 40/41 rows — portal changed layout",
  },
  {
    phase: "self_healed",
    label: "Self-healed",
    note: "Re-derived extraction via Bright Data — field recovered",
  },
];

const PHASE_COLORS: Record<HealPhase, { text: string; bg: string; bar: string; ring: string }> = {
  healthy: {
    text: "var(--color-ok)",
    bg: "var(--color-surface-2)",
    bar: "var(--color-ok)",
    ring: "var(--color-ok)",
  },
  broken: {
    text: "var(--color-danger)",
    bg: "var(--color-surface-2)",
    bar: "var(--color-danger)",
    ring: "var(--color-danger)",
  },
  self_healed: {
    text: "var(--color-warn)",
    bg: "var(--color-surface-2)",
    bar: "var(--color-warn)",
    ring: "var(--color-warn)",
  },
};

const PHASE_COMPLETENESS: Record<HealPhase, number> = {
  healthy: 97,
  broken: 41,
  self_healed: 92,
};

/** SVG icon path per status — matches StatusPill exactly. */
function StatusIcon({ phase, size = 14 }: { phase: HealPhase; size?: number }) {
  const color = PHASE_COLORS[phase].text;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {phase === "healthy" && (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M5 8.5l2.5 2.5L11 6" />
        </>
      )}
      {phase === "broken" && (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
        </>
      )}
      {phase === "self_healed" && (
        <path d="M11.5 4.5a5 5 0 1 0 .5 5.5M12 3v3h-3" />
      )}
    </svg>
  );
}

/* ================================================================== */
/*  IntersectionObserver hook — fires once when element enters view     */
/* ================================================================== */

function useInView(threshold = 0.3): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
}

/* ================================================================== */
/*  Self-Heal Card — the animated collector card                       */
/* ================================================================== */

function SelfHealCard({ active }: { active: boolean }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check for reduced motion preference — safe default: true (no animation)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Start cycling when active and not reduced-motion
  useEffect(() => {
    if (!active || prefersReducedMotion) {
      // Reset to final state for reduced-motion
      if (prefersReducedMotion) setPhaseIndex(2);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function runCycle() {
      if (cancelled) return;
      setPhaseIndex(0);
      setIsAnimating(true);

      timers.push(setTimeout(() => { if (!cancelled) setPhaseIndex(1); }, 2000));
      timers.push(setTimeout(() => { if (!cancelled) setPhaseIndex(2); }, 4000));
      timers.push(setTimeout(() => { if (!cancelled) setIsAnimating(false); }, 4600));
      // Restart after a pause (total cycle ~8s)
      timers.push(setTimeout(() => { if (!cancelled) runCycle(); }, 8000));
    }

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active, prefersReducedMotion]);


  const current = HEAL_PHASES[phaseIndex];
  const colors = PHASE_COLORS[current.phase];
  const completeness = PHASE_COMPLETENESS[current.phase];

  return (
    <div
      className="landing-heal-card"
      style={{
        ["--ring-color" as string]: colors.ring,
      }}
      data-animating={isAnimating ? "true" : "false"}
    >
      {/* Card header */}
      <div className="landing-heal-card-header">
        <div>
          <div className="landing-heal-card-name">punjab_apmc</div>
          <div className="landing-heal-card-target">
            Punjab · <span style={{ color: "var(--color-brand)" }}>enam.gov.in</span>
          </div>
        </div>
        <span
          className="landing-heal-pill"
          style={{ color: colors.text, background: colors.bg }}
        >
          <StatusIcon phase={current.phase} size={12} />
          {current.label}
        </span>
      </div>

      {/* Completeness bar */}
      <div className="landing-heal-bar-section">
        <div className="landing-heal-bar-labels">
          <span>Field completeness</span>
          <span
            className="landing-heal-bar-pct"
            style={{ color: colors.text }}
          >
            {completeness}%
          </span>
        </div>
        <div className="landing-heal-bar-track">
          <div
            className="landing-heal-bar-fill"
            style={{
              width: `${completeness}%`,
              background: colors.bar,
            }}
          />
        </div>
      </div>

      {/* Timeline entries */}
      <div className="landing-heal-timeline">
        {HEAL_PHASES.slice(0, phaseIndex + 1)
          .reverse()
          .map((p, i) => (
            <div
              key={p.phase}
              className="landing-heal-timeline-row"
              style={{
                opacity: i === 0 ? 1 : 0.5,
              }}
            >
              <div
                className="landing-heal-timeline-dot"
                style={{ background: PHASE_COLORS[p.phase].text }}
              />
              <div className="landing-heal-timeline-content">
                <div className="landing-heal-timeline-header">
                  <StatusIcon phase={p.phase} size={10} />
                  <span style={{ color: PHASE_COLORS[p.phase].text, fontWeight: 500 }}>
                    {p.label}
                  </span>
                  <span className="landing-heal-timeline-ago">
                    {p.phase === "healthy" ? "1h ago" : p.phase === "broken" ? "25m ago" : "just now"}
                  </span>
                </div>
                <div className="landing-heal-timeline-note">{p.note}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Mini ranked table snippet — static, showcasing the data tool       */
/* ================================================================== */

function MiniTable() {
  const rows = [
    { rank: 1, mandi: "Khanna", state: "Punjab", price: 2450, fresh: "2h ago" },
    { rank: 2, mandi: "Narela", state: "Delhi", price: 2510, fresh: "4h ago" },
    { rank: 3, mandi: "Indore", state: "MP", price: 2580, fresh: "1h ago" },
    { rank: 4, mandi: "Bhopal", state: "MP", price: 2620, fresh: "3h ago" },
  ];

  return (
    <div className="landing-mini-table">
      <div className="landing-mini-table-header">
        <span>#</span>
        <span>Mandi</span>
        <span className="landing-mini-table-right">Price (₹/qtl)</span>
        <span className="landing-mini-table-right">Verified</span>
      </div>
      {rows.map((r) => (
        <div key={r.rank} className="landing-mini-table-row">
          <span className="landing-mini-table-rank">{r.rank}</span>
          <span>
            <span className="landing-mini-table-mandi">{r.mandi}</span>
            <span className="landing-mini-table-state">{r.state}</span>
          </span>
          <span className="landing-mini-table-price">₹{r.price.toLocaleString("en-IN")}</span>
          <span className="landing-mini-table-fresh">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6.5" />
              <ellipse cx="8" cy="8" rx="3" ry="6.5" />
              <line x1="1.5" y1="8" x2="14.5" y2="8" />
            </svg>
            {r.fresh}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Landing Page                                                       */
/* ================================================================== */

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [healSectionRef, healInView] = useInView(0.25);
  const [howItWorksRef, howItWorksInView] = useInView(0.2);

  // Trigger hero entrance after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="landing-root">
      {/* ── Minimal header ── */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" />
              <path d="M12 2c3 3 4.5 6.5 4.5 10" />
              <path d="M2.5 9h19M2.5 15h12" />
            </svg>
            <span className="landing-logo-text">CropRoute</span>
          </div>

          <Link
            href="/app/results/wheat"
            className="landing-header-cta"
            id="landing-header-cta"
          >
            Open App →
          </Link>
        </div>
      </header>

      {/* ── Hero section ── */}
      <section
        className={`landing-hero ${heroVisible ? "landing-hero-visible" : ""}`}
        id="landing-hero"
      >
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <h1 className="landing-hero-title">
              Live wholesale prices,
              <br />
              <span className="landing-hero-title-accent">ranked and verified</span>
              <br />
              across India.
            </h1>

            <p className="landing-hero-subtitle">
              Search a commodity. Get ranked mandi prices, dealer contacts,
              and self-healing data you can actually trust — updated hourly,
              sourced transparently.
            </p>

            <div className="landing-hero-actions">
              <Link
                href="/app/results/wheat"
                className="landing-cta-primary"
                id="landing-cta-primary"
              >
                Search Wheat Prices
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <a href="#how-it-works" className="landing-cta-secondary">
                How it works
              </a>
            </div>
          </div>

          {/* Hero visual — mini table preview */}
          <div className="landing-hero-visual">
            <div className="landing-hero-visual-label">
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
              >
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 4.5V8l2.5 1.5" />
              </svg>
              Live preview · Wheat
            </div>
            <MiniTable />
          </div>
        </div>
      </section>

      {/* ── Self-Heal section — the signature moment ── */}
      <section
        ref={healSectionRef as React.RefObject<HTMLElement>}
        className={`landing-heal-section ${healInView ? "landing-section-visible" : ""}`}
        id="self-heal-demo"
      >
        <div className="landing-heal-inner">
          <div className="landing-heal-text">
            <div className="landing-section-eyebrow">Core Differentiator</div>
            <h2 className="landing-section-title">
              Data that
              <span className="landing-hero-title-accent"> heals itself.</span>
            </h2>
            <p className="landing-section-body">
              Government portals break without warning — a table becomes a div,
              a phone column becomes an image. CropRoute detects broken fields
              automatically, re-derives the extraction, and verifies recovery.
              Every transition is logged with evidence, not just claimed.
            </p>
            <p className="landing-section-body landing-section-body-muted">
              This isn&apos;t error handling. It&apos;s a visible, reproducible
              break-and-heal cycle backed by a full audit trail.
            </p>
          </div>

          <div className="landing-heal-demo">
            <SelfHealCard active={healInView} />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        ref={howItWorksRef as React.RefObject<HTMLElement>}
        className={`landing-how-section ${howItWorksInView ? "landing-section-visible" : ""}`}
        id="how-it-works"
      >
        <div className="landing-how-inner">
          <div className="landing-section-eyebrow" style={{ textAlign: "center" }}>
            Three Steps
          </div>
          <h2 className="landing-section-title" style={{ textAlign: "center" }}>
            From search to sourcing decision.
          </h2>

          <div className="landing-how-grid">
            <div className="landing-how-step">
              <div className="landing-how-step-number">1</div>
              <h3 className="landing-how-step-title">Search a commodity</h3>
              <p className="landing-how-step-body">
                Type &quot;wheat&quot; or &quot;rice&quot; — get every mandi reporting that commodity across India, ranked by price.
              </p>
            </div>
            <div className="landing-how-step">
              <div className="landing-how-step-number">2</div>
              <h3 className="landing-how-step-title">Compare live prices</h3>
              <p className="landing-how-step-body">
                See modal prices, arrival volumes, 7-day trends, and weather — all sourced and timestamped, never unattributed.
              </p>
            </div>
            <div className="landing-how-step">
              <div className="landing-how-step-number">3</div>
              <h3 className="landing-how-step-title">Contact dealers</h3>
              <p className="landing-how-step-body">
                Tap any mandi to see verified dealer contacts with direct call links. Know the price, know the seller.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-final-cta">
        <div className="landing-final-cta-inner">
          <h2 className="landing-final-cta-title">
            Stop guessing. Start sourcing.
          </h2>
          <Link
            href="/app/results/wheat"
            className="landing-cta-primary landing-cta-primary-large"
            id="landing-cta-final"
          >
            Open CropRoute
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span>CropRoute — Wholesale price intelligence for India</span>
          <span className="landing-footer-dot">·</span>
          <span>Built for Bright Data Web Scraping Challenge</span>
        </div>
      </footer>
    </div>
  );
}

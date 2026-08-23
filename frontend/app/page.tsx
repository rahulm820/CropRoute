"use client";

/**
 * CropRoute — Single-file landing page.
 * Lovable.dev visual design reference integrated cleanly into CropRoute design system.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useReveal<T extends HTMLElement>(rootMargin = "-12% 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, seen };
}

function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header";
}) {
  const { ref, seen } = useReveal<HTMLDivElement>();
  const Comp = Tag as any;
  return (
    <Comp
      ref={ref as any}
      className={`cr-rv ${seen ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Comp>
  );
}

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setY(window.scrollY);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return y;
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const shell = "mx-auto w-full max-w-[1280px] px-5 sm:px-8";

function Leaf({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 4C10.5 4 4 8.9 4 15.5 4 18 5 20 5 20S8.5 12 20 8.5C20 8.5 12.5 12.5 8 20c8.5 1.5 12-5.5 12-16Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Pill({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "accent" }) {
  const bg = tone === "brand" ? "var(--color-brand-soft)" : "var(--color-accent-soft)";
  const fg = tone === "brand" ? "var(--color-brand)" : "var(--color-accent)";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium tracking-[0.02em]"
      style={{ background: bg, color: fg, border: "1px solid color-mix(in oklab, currentColor 22%, transparent)" }}
    >
      {children}
    </span>
  );
}

function PrimaryLink({
  href,
  children,
  large = false,
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`cr-btn inline-flex items-center justify-center gap-2 rounded-[999px] font-semibold ${
        large ? "px-8 py-4 text-[16px]" : "px-5 py-2.5 text-[14px]"
      }`}
      style={{
        background: "var(--color-brand)",
        color: "#FFFFFF",
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-brand-strong)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-brand)")}
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="cr-btn inline-flex items-center gap-2 rounded-[999px] px-5 py-2.5 text-[14px] font-medium"
      style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--color-text)";
        e.currentTarget.style.background = "var(--color-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--color-text-muted)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */

function Nav() {
  const y = useScrollY();
  const solid = y > 40;
  return (
    <header
      className="cr-fade fixed inset-x-0 top-0 z-50"
      style={{
        backdropFilter: solid ? "saturate(150%) blur(14px)" : "none",
        WebkitBackdropFilter: solid ? "saturate(150%) blur(14px)" : "none",
        background: solid ? "color-mix(in srgb, var(--color-bg) 85%, transparent)" : "transparent",
        borderBottom: solid ? "1px solid var(--color-border)" : "1px solid transparent",
      }}
    >
      <div className={`${shell} flex h-16 items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[8px]"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            <Leaf />
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.01em]">CropRoute</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/rahulm820/CropRoute"
            target="_blank"
            rel="noreferrer"
            aria-label="View CropRoute on GitHub"
            className="cr-btn hidden h-9 w-9 items-center justify-center rounded-[999px] sm:flex"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
          </a>
          <PrimaryLink href="/results/wheat">Open App</PrimaryLink>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

type Row = { state: string; mandi: string; price: string; ago: string; delta: string; up: boolean };

const ROWS: Row[] = [
  { state: "Madhya Pradesh", mandi: "Indore", price: "2,612", ago: "12m", delta: "+1.4%", up: true },
  { state: "Uttar Pradesh", mandi: "Hapur", price: "2,548", ago: "38m", delta: "+0.6%", up: true },
  { state: "Rajasthan", mandi: "Kota", price: "2,505", ago: "3h", delta: "-0.4%", up: false },
  { state: "Punjab", mandi: "Khanna", price: "2,470", ago: "1h", delta: "+0.9%", up: true },
  { state: "Haryana", mandi: "Karnal", price: "2,432", ago: "4h", delta: "-1.1%", up: false },
];

function PriceCard({ tilt = 0 }: { tilt?: number }) {
  return (
    <div
      className="cr-parallax overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
        transform: `translate3d(0, ${tilt}px, 0)`,
        willChange: "transform",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}
      >
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span className="cr-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-ok)" }} />
          wheat · ranked by modal price
        </div>
        <span className="cr-num text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          ₹/quintal
        </span>
      </div>

      <ul>
        {ROWS.map((r, i) => (
          <li
            key={r.mandi}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i === ROWS.length - 1 ? "none" : "1px solid var(--color-border)" }}
          >
            <span className="cr-num w-5 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{r.mandi}</p>
              <p className="truncate text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                {r.state} · verified {r.ago} ago
              </p>
            </div>
            <div className="text-right">
              <p className="cr-num text-[15px] font-semibold">₹{r.price}</p>
              <p className="cr-num text-[12px]" style={{ color: r.up ? "var(--color-ok)" : "var(--color-danger)" }}>
                {r.up ? "▲" : "▼"} {r.delta}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="flex items-center justify-between px-4 py-3 text-[12px]"
        style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <span>Source: verified dealer reports, mandi-level</span>
        <span className="cr-num">run #4821</span>
      </div>
    </div>
  );
}

function Hero() {
  const y = useScrollY();
  const drift = Math.min(y * 0.06, 40);
  return (
    <section className="relative z-10 pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className={`${shell} grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16`}>
        <div>
          <Reveal>
            <Pill>
              <span className="cr-pulse h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
              Live from a verified all-India dealer network
            </Pill>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-6 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[46px] lg:text-[56px]">
              Live wholesale prices,
              <br />
              ranked and verified
              <br />
              <span style={{ color: "var(--color-brand)" }}>across India.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-[560px] text-[16px] leading-[1.65]" style={{ color: "var(--color-text-muted)" }}>
              Search a commodity, get every mandi in the country ranked by price and arrival volume, pull verified
              dealer and commission-agent contacts — reported live from the ground by a collector network that
              detects its own breakage and heals it.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryLink href="/results/wheat" large>
                Search wheat prices <span aria-hidden="true">→</span>
              </PrimaryLink>
              <GhostLink href="#how-it-works">How it works ↓</GhostLink>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <dl className="mt-12 grid max-w-[540px] grid-cols-3 gap-6">
              {[
                ["3,400+", "mandis tracked"],
                ["28", "states covered"],
                ["100%", "rows with a source link"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="cr-num text-[24px] font-semibold tracking-[-0.02em]">{n}</dt>
                  <dd className="mt-1 text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <PriceCard tilt={-drift * 0.35} />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Self-heal signature section                                         */
/* ------------------------------------------------------------------ */

type Phase = {
  key: "healthy" | "broken" | "self_healed";
  label: string;
  pct: number;
  color: string;
  soft: string;
  note: string;
  stamp: string;
};

const PHASES: Phase[] = [
  {
    key: "healthy",
    label: "Healthy",
    pct: 97,
    color: "var(--color-ok)",
    soft: "var(--color-brand-soft)",
    note: "All 12 mapped fields populated across 41/41 rows.",
    stamp: "1h ago",
  },
  {
    key: "broken",
    label: "Broken",
    pct: 41,
    color: "var(--color-danger)",
    soft: "color-mix(in oklab, var(--color-danger) 12%, transparent)",
    note: "office_phone empty in 40/41 rows — source site changed layout.",
    stamp: "25m ago",
  },
  {
    key: "self_healed",
    label: "Self-healed",
    pct: 92,
    color: "var(--color-accent)",
    soft: "var(--color-accent-soft)",
    note: "Re-derived extraction via Bright Data — field recovered.",
    stamp: "just now",
  },
];

function SelfHeal() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => setLive(es[0]?.isIntersecting ?? false), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActive(2);
      return;
    }
    const t = window.setInterval(() => setActive((a) => (a + 1) % PHASES.length), 2600);
    return () => window.clearInterval(t);
  }, [live]);

  const p = PHASES[active]!;

  return (
    <section id="self-heal" ref={hostRef} className="relative z-10 py-24 sm:py-32">
      <div className={`${shell} grid gap-14 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:gap-20`}>
        <div>
          <Reveal>
            <Pill tone="accent">The differentiator</Pill>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="mt-6 text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
              Data that heals itself.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6 max-w-[520px] space-y-4 text-[16px] leading-[1.7]" style={{ color: "var(--color-text-muted)" }}>
              <p>
                Source sites change without warning — a table becomes a div, a phone column becomes an
                image — and most scrapers keep returning confident, empty rows.
              </p>
              <p>
                CropRoute runs one Bright Data collector per source and watches field completeness on every run. The
                moment a mapped field collapses, the collector re-derives its extraction, re-runs, and verifies
                recovery.
              </p>
              <p>
                Every transition — <span style={{ color: "var(--color-text)" }}>healthy → broken → self_healed</span> — is
                logged with the evidence that triggered it. Not a status badge. A paper trail.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div
            className="overflow-hidden rounded-[12px]"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)" }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3 text-[12px]"
              style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
            >
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-danger)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-ok)" }} />
              </span>
              <span className="ml-2">scraper-studio / collectors / mp-07</span>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                    MP market feed · collector #mp-07
                  </p>
                  <p className="mt-1 text-[17px] font-semibold">Field completeness</p>
                </div>
                <span
                  className="cr-fade shrink-0 rounded-[999px] px-3 py-1 text-[12px] font-semibold"
                  style={{ color: p.color, background: p.soft, border: `1px solid ${p.color}` }}
                >
                  {p.label}
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between">
                <span className="cr-num cr-fade text-[40px] font-semibold leading-none" style={{ color: p.color }}>
                  {p.pct}%
                </span>
                <span className="cr-num text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                  41 rows · 12 mapped fields
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-[999px]" style={{ background: "var(--color-surface-2)" }}>
                <div className="cr-bar h-full rounded-[999px]" style={{ width: `${p.pct}%`, background: p.color }} />
              </div>

              <div
                className="cr-fade mt-5 min-h-[64px] rounded-[8px] px-4 py-3 text-[13px] leading-[1.6]"
                style={{ background: p.soft, border: `1px solid ${p.color}`, color: "var(--color-text)" }}
              >
                <span className="cr-num" style={{ color: p.color }}>
                  evidence ·{" "}
                </span>
                {p.note}
              </div>

              <div className="mt-6" style={{ borderTop: "1px solid var(--color-border)" }}>
                <p className="pt-4 text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                  Transition log
                </p>
                <ol className="mt-3 space-y-3">
                  {PHASES.map((ph, i) => {
                    const on = i <= active;
                    return (
                      <li key={ph.key} className="cr-fade flex items-center gap-3" style={{ opacity: on ? 1 : 0.32 }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ph.color }} />
                        <span className="cr-num text-[13px] font-medium" style={{ color: ph.color }}>
                          {ph.key}
                        </span>
                        <span className="h-px flex-1" style={{ background: "var(--color-border)" }} />
                        <span className="cr-num text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                          {ph.stamp}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

const SOURCES = ["Verified dealer network", "Commission-agent reports", "Bright Data Scraper Studio", "Open-Meteo"];

function TrustStrip() {
  return (
    <Reveal as="section" className="relative z-10">
      <div className={shell}>
        <div className="cr-hairline" />
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {SOURCES.map((s) => (
              <span key={s} className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                {s}
              </span>
            ))}
          </div>
          <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
            Every number traces back to a verified dealer report or a live collector run — never a guess.
          </p>
        </div>
        <div className="cr-hairline" />
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    t: "Search a commodity",
    d: "Type a commodity name and get every mandi reporting it across India, ranked by price and arrival volume.",
  },
  {
    n: "02",
    t: "Compare live prices",
    d: "Modal prices, arrival tonnage, week-on-week trend and regional weather — each field sourced and timestamped.",
  },
  {
    n: "03",
    t: "Contact dealers",
    d: "Tap any mandi for verified dealer and commission-agent contacts with direct call links.",
  },
];

function Steps() {
  return (
    <section id="how-it-works" className="relative z-10 py-24 sm:py-32">
      <div className={shell}>
        <Reveal>
          <h2 className="max-w-[720px] text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
            From a commodity name to a dealer on the phone.
          </h2>
        </Reveal>
        <Reveal delay={60}>
          <p className="mt-4 text-[16px]" style={{ color: "var(--color-text-muted)" }}>
            Three steps, no spreadsheets, no cold-calling blind.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-[12px] sm:grid-cols-3" style={{ background: "var(--color-border)", border: "1px solid var(--color-border)" }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="h-full p-6 sm:p-8" style={{ background: "var(--color-surface)" }}>
                <span className="cr-num text-[13px] font-semibold" style={{ color: "var(--color-brand)" }}>
                  {s.n}
                </span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.01em]">{s.t}</h3>
                <p className="mt-3 text-[15px] leading-[1.65]" style={{ color: "var(--color-text-muted)" }}>
                  {s.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Attribution + coverage                                              */
/* ------------------------------------------------------------------ */

const PROOFS = [
  ["Source on every row", "Each price carries its source — the dealer or feed it came from — plus the run ID of the collector that read it."],
  ["Last-verified timestamps", "Freshness is shown in relative time on every field. Stale rows are visually demoted, never silently reused."],
  ["Dealer-verified baseline", "Every modal price is cross-checked against multiple dealer reports per mandi, so outliers surface immediately."],
  ["Weather in context", "Open-Meteo forecasts per mandi district — arrivals and prices move with the rain."],
  ["Input cost tracking", "Fertilizer and input price movement alongside output prices, for real margin context."],
  ["Sowing & harvest windows", "Crop calendars per agro-climatic zone so buyers can time procurement, not react to it."],
];

function Attribution() {
  return (
    <section className="relative z-10 pb-24 sm:pb-32">
      <div className={shell}>
        <Reveal>
          <h2 className="max-w-[760px] text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
            Attribution is not a footnote. It&apos;s the product.
          </h2>
        </Reveal>

        <div
          className="mt-14 grid gap-px overflow-hidden rounded-[12px] sm:grid-cols-2 lg:grid-cols-3"
          style={{ background: "var(--color-border)", border: "1px solid var(--color-border)" }}
        >
          {PROOFS.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 80}>
              <div className="h-full p-6 sm:p-7" style={{ background: "var(--color-surface)" }}>
                <h3 className="text-[16px] font-semibold">{t}</h3>
                <p className="mt-2.5 text-[14px] leading-[1.65]" style={{ color: "var(--color-text-muted)" }}>
                  {d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Demo — YouTube walkthrough                                          */
/* ------------------------------------------------------------------ */

const YOUTUBE_ID = "dQw4w9WgXcQ";
const YOUTUBE_TITLE = "CropRoute product walkthrough";

const DEMO_CHAPTERS = [
  ["00:04", "Search a commodity"],
  ["00:18", "Ranked mandis by price"],
  ["00:35", "Drill into a mandi"],
  ["00:48", "Verified dealer contacts"],
  ["01:02", "Self-heal event, live"],
];

function Demo() {
  const [playing, setPlaying] = useState(false);

  return (
    <section id="demo" className="relative z-10 pb-24 sm:pb-32">
      <div className={shell}>
        <Reveal>
          <Pill>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
            Product demo
          </Pill>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="mt-6 text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
            Watch the full loop, end to end.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 max-w-[620px] text-[16px] leading-[1.65]" style={{ color: "var(--color-text-muted)" }}>
            Search a commodity, rank every reporting mandi, drill into one, call the dealer — and watch a collector
            detect its own breakage and heal it, on camera.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] lg:grid-cols-[1.55fr_.45fr]" style={{ background: "var(--color-border)", border: "1px solid var(--color-border)", boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)" }}>
            {/* player */}
            <div style={{ background: "var(--color-surface)" }}>
              <div
                className="flex items-center gap-2 px-4 py-3 text-[12px]"
                style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
              >
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-danger)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-ok)" }} />
                </span>
                <span className="ml-2">app.croproute.in / results / wheat</span>
              </div>

              {/* 16:9 frame */}
              <div className="relative w-full" style={{ aspectRatio: "16 / 9", background: "#000" }}>
                {playing ? (
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                    title={YOUTUBE_TITLE}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={`Play video: ${YOUTUBE_TITLE}`}
                    className="group absolute inset-0 h-full w-full cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ opacity: 0.82 }}
                    />
                    <span
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.55))" }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="cr-btn flex h-16 w-16 items-center justify-center rounded-[999px] sm:h-20 sm:w-20"
                        style={{ background: "var(--color-brand)", color: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,.35)" }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                        </svg>
                      </span>
                    </span>
                    <span
                      className="cr-num absolute bottom-4 left-4 rounded-[999px] px-3 py-1 text-[12px] font-medium"
                      style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}
                    >
                      2 min walkthrough
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* chapters */}
            <div className="p-5 sm:p-7" style={{ background: "var(--color-surface-2)" }}>
              <Eyebrow>In this demo</Eyebrow>
              <ol className="mt-5 space-y-4">
                {DEMO_CHAPTERS.map(([time, label]) => (
                  <li key={label} className="flex items-baseline gap-3">
                    <span className="cr-num w-[38px] shrink-0 text-[12px]" style={{ color: "var(--color-brand)" }}>
                      {time}
                    </span>
                    <span className="text-[14px] leading-[1.5]">{label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-[13px] leading-[1.6]" style={{ color: "var(--color-text-muted)" }}>
                Every figure on screen is sourced with a provenance chip and a last-verified timestamp.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing + footer                                                    */
/* ------------------------------------------------------------------ */

function Closing() {
  return (
    <section className="relative z-10 py-28 sm:py-36">
      <div className={`${shell} text-center`}>
        <Reveal>
          <h2 className="mx-auto max-w-[820px] text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[54px]">
            Stop guessing. Start sourcing.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px]" style={{ color: "var(--color-text-muted)" }}>
            Open the terminal and see today&apos;s ranked wheat prices across every reporting mandi in India.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-10 flex justify-center">
            <PrimaryLink href="/results/wheat" large>
              Open CropRoute <span aria-hidden="true">→</span>
            </PrimaryLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 pb-14">
      <div className={shell}>
        <div className="cr-hairline" />
        <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-semibold">CropRoute — Wholesale price intelligence for India</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              Built for the Bright Data Web Scraping Challenge.
            </p>
          </div>
          <a
            href="https://github.com/rahulm820/CropRoute"
            target="_blank"
            rel="noreferrer"
            className="cr-btn inline-flex w-fit items-center gap-2 rounded-[999px] px-4 py-2 text-[13px]"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CropRouteLanding() {
  const marquee = useMemo(
    () => [...SOURCES, ...SOURCES, ...SOURCES, ...SOURCES].map((s, i) => ({ s, i })),
    []
  );

  return (
    <div className="cr-root relative min-h-screen">
      <div className="cr-field" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <SelfHeal />
        <Steps />
        <Attribution />
        <Demo />

        {/* quiet provenance marquee */}
        <div className="relative z-10 overflow-hidden pb-24" aria-hidden="true">
          <div className={shell}>
            <div className="cr-hairline" />
          </div>
          <div className="mt-6 flex w-[200%] gap-12 whitespace-nowrap">
            <div className="cr-marquee flex gap-12">
              {marquee.map(({ s, i }) => (
                <span key={`${s}-${i}`} className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Closing />
      </main>
      <Footer />
    </div>
  );
}

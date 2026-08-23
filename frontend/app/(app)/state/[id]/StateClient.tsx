"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WeatherScene,
  NewsCard,
  TrendDelta,
  ProvenanceChip,
  EmptyState,
  ErrorState,
} from "@/components";
import type {
  StateBundle,
  TopMandi,
  Section,
  WeatherData,
  NewsItem,
  FertilizerItem,
  KnowledgeItem,
} from "./page";

/* ------------------------------------------------------------------ */
/*  Section wrapper — title + status pill + body                       */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  section,
  children,
}: {
  title: string;
  section: Section<unknown>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-[14px] font-semibold text-text">{title}</h2>
        <StatusDot status={section.status} />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    ok: { color: "bg-accent", label: "Live" },
    stale: { color: "bg-amber-500", label: "Stale" },
    empty: { color: "bg-text-muted", label: "No data" },
    failed: { color: "bg-red-500", label: "Failed" },
  };
  const { color, label } = map[status] || map.empty;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
      <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline — 80x24, no axes, single brand stroke, endpoint dot     */
/* ------------------------------------------------------------------ */

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = pad + ((data.length - 1) / (data.length - 1)) * (w - 2 * pad);
  const lastY = pad + (1 - (data[data.length - 1] - min) / range) * (h - 2 * pad);

  return (
    <svg width={w} height={h} className="flex-shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand"
      />
      <circle cx={lastX} cy={lastY} r="2" fill="currentColor" className="text-brand" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Top mandis table                                                   */
/* ------------------------------------------------------------------ */

function TopMandisTable({ mandis }: { mandis: TopMandi[] }) {
  if (!mandis.length) {
    return (
      <EmptyState
        icon={<MandiIcon />}
        message="No mandi price data available for this state"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 text-text-muted font-medium">Mandi</th>
            <th className="text-left py-2 text-text-muted font-medium">Commodity</th>
            <th className="text-right py-2 text-text-muted font-medium">Modal Price</th>
            <th className="text-right py-2 text-text-muted font-medium">Trend</th>
            <th className="py-2 text-text-muted font-medium" aria-label="7-day chart" />
          </tr>
        </thead>
        <tbody>
          {mandis.map((m) => (
            <tr
              key={m.mandi_id}
              className="border-b border-border/50 hover:bg-surface-2 transition-colors"
            >
              <td className="py-2.5">
                <Link
                  href={`/mandi/${m.mandi_id}`}
                  className="text-brand hover:underline font-medium"
                >
                  {m.mandi}
                </Link>
              </td>
              <td className="py-2.5 text-text-muted">
                {m.commodity || (m.commodity_id ? `#${m.commodity_id}` : "—")}
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums">
                ₹{m.modal_price.toLocaleString("en-IN")}
              </td>
              <td className="py-2.5 text-right">
                <TrendDelta value={null} />
              </td>
              <td className="py-2.5 pl-2">
                <Sparkline data={m.trend_7d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weather card                                                       */
/* ------------------------------------------------------------------ */

function WeatherCard({ section }: { section: Section<WeatherData> }) {
  if (section.status === "failed") {
    return (
      <SectionCard title="Weather" section={section}>
        <ErrorState
          message="Weather data unavailable"
          fallback={section.error}
        />
      </SectionCard>
    );
  }
  if (section.status === "empty" || !section.data) {
    return (
      <SectionCard title="Weather" section={section}>
        <EmptyState
          icon={<WeatherIcon />}
          message="No weather data for this state"
        />
      </SectionCard>
    );
  }

  const { current, daily, source_url, fetched_at } = section.data;

  return (
    <SectionCard title="Weather" section={section}>
      <div className="flex items-start gap-4">
        <WeatherScene condition={current.condition as any} />
        <div className="flex-1 min-w-0">
          <div className="text-[28px] font-semibold text-text leading-tight">
            {Math.round(current.temp_c)}°C
          </div>
          <div className="text-[13px] text-text-muted capitalize mt-0.5">
            {current.condition.replace("-", " ")}
          </div>
          <div className="flex gap-4 mt-2 text-[12px] text-text-muted">
            <span>Humidity {current.humidity}%</span>
            <span>Wind {Math.round(current.wind_kph)} km/h</span>
          </div>
        </div>
      </div>

      {/* 7-day forecast strip */}
      {daily.length > 0 && (
        <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
          {daily.map((d) => (
            <div
              key={d.date}
              className="flex flex-col items-center min-w-[56px] text-[11px]"
            >
              <span className="text-text-muted">
                {new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>
              <WeatherScene condition={d.condition as any} />
              <span className="font-medium">
                {Math.round(d.max_c)}°
              </span>
              <span className="text-text-muted">
                {Math.round(d.min_c)}°
              </span>
              {d.rain_mm > 0 && (
                <span className="text-blue-500">{d.rain_mm}mm</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <ProvenanceChip
          sourceUrl={source_url}
          scrapedAt={fetched_at}
          collectorName="open-meteo"
        />
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  News card                                                          */
/* ------------------------------------------------------------------ */

function NewsSection({ section }: { section: Section<NewsItem[]> }) {
  if (section.status === "failed") {
    return (
      <SectionCard title="Agri News" section={section}>
        <ErrorState
          message="News feed unavailable"
          fallback={section.error}
        />
      </SectionCard>
    );
  }
  if (section.status === "empty" || !section.data?.length) {
    return (
      <SectionCard title="Agri News" section={section}>
        <EmptyState
          icon={<NewsIcon />}
          message="No news articles found for this state"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Agri News" section={section}>
      <div className="space-y-4">
        {section.data.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Fertilizer card                                                    */
/* ------------------------------------------------------------------ */

function FertilizerSection({ section }: { section: Section<FertilizerItem[]> }) {
  if (section.status === "failed") {
    return (
      <SectionCard title="Fertilizer Prices" section={section}>
        <ErrorState
          message="Fertilizer data unavailable"
          fallback={section.error}
        />
      </SectionCard>
    );
  }
  if (section.status === "empty" || !section.data?.length) {
    return (
      <SectionCard title="Fertilizer Prices" section={section}>
        <EmptyState
          icon={<FertilizerIcon />}
          message="No fertilizer price data for this state"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fertilizer Prices" section={section}>
      <div className="space-y-3">
        {section.data.map((item) => (
          <div
            key={item.product}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
          >
            <div>
              <div className="text-[13px] font-medium text-text">
                {item.product}
              </div>
              <div className="text-[11px] text-text-muted">{item.unit}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-semibold tabular-nums">
                ₹{item.price.toLocaleString("en-IN")}
              </span>
              <TrendDelta value={item.delta_pct} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        {section.data[0] && (
          <ProvenanceChip
            sourceUrl={section.data[0].source_url}
            scrapedAt={section.data[0].scraped_at}
            collectorName="fertilizer_retail"
          />
        )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Knowledge card                                                     */
/* ------------------------------------------------------------------ */

function KnowledgeSection({ section }: { section: Section<KnowledgeItem[]> }) {
  if (section.status === "failed") {
    return (
      <SectionCard title="Crop Knowledge" section={section}>
        <ErrorState
          message="Knowledge data unavailable"
          fallback={section.error}
        />
      </SectionCard>
    );
  }
  if (section.status === "empty" || !section.data?.length) {
    return (
      <SectionCard title="Crop Knowledge" section={section}>
        <EmptyState
          icon={<KnowledgeIcon />}
          message="Crop knowledge not yet seeded for this state"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Crop Knowledge" section={section}>
      <div className="space-y-4">
        {section.data.map((k) => (
          <div key={k.commodity} className="py-2 border-b border-border/50 last:border-0">
            <div className="text-[13px] font-medium text-text mb-1">
              {k.commodity}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-text-muted">
              <div>
                <span className="font-medium">Sowing:</span> {k.sowing_window}
              </div>
              <div>
                <span className="font-medium">Harvest:</span> {k.harvest_window}
              </div>
            </div>
            {k.districts.length > 0 && (
              <div className="mt-1 text-[12px] text-text-muted">
                <span className="font-medium">Districts:</span>{" "}
                {k.districts.join(", ")}
              </div>
            )}
            {k.notes && (
              <div className="mt-1 text-[12px] text-text-muted italic">
                {k.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon components (inline SVG, matching UI-DESIGN.md icon style)     */
/* ------------------------------------------------------------------ */

function MandiIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function FertilizerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  StateClient — main page assembler                                  */
/* ------------------------------------------------------------------ */

export default function StateClient({
  initialBundle,
  initialError,
}: {
  initialBundle: StateBundle | null;
  initialError: string | null;
}) {
  const bundle = initialBundle;
  const error = initialError;

  if (error || !bundle) {
    return (
      <main className="max-w-content mx-auto px-4 py-6">
        <ErrorState
          message="Could not load state data"
          fallback={error || "Unknown error"}
        />
      </main>
    );
  }

  const { state, top_mandis, weather, news, fertilizer, knowledge } = bundle;

  return (
    <main className="max-w-content mx-auto px-4 py-6">
      {/* ---- State header ---- */}
      <div className="mb-6">
        <h1 className="text-[32px] leading-[38px] font-semibold text-text">
          {state.name}
        </h1>
        <p className="text-[13px] text-text-muted mt-1">
          {state.mandi_count} mandis
          {state.lat != null && state.lng != null && (
            <> &middot; {state.lat.toFixed(2)}°N, {state.lng.toFixed(2)}°E</>
          )}
        </p>
      </div>

      {/* ---- Cards grid ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full-width: top mandis */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-[14px] font-semibold text-text">
                Top Mandis
              </h2>
            </div>
            <div className="p-4">
              <TopMandisTable mandis={top_mandis} />
            </div>
          </div>
        </div>

        {/* Weather — spans full width on mobile, left column on desktop */}
        <WeatherCard section={weather} />

        {/* News — right column on desktop */}
        <NewsSection section={news} />

        {/* Fertilizer */}
        <FertilizerSection section={fertilizer} />

        {/* Knowledge */}
        <KnowledgeSection section={knowledge} />
      </div>
    </main>
  );
}

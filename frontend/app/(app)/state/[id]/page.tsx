import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import StateClient from "./StateClient";

/* ------------------------------------------------------------------ */
/*  Types matching GET /api/state/:id contract (docs/API.md)           */
/* ------------------------------------------------------------------ */

export interface StateHeader {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  mandi_count: number;
}

export interface TopMandi {
  mandi_id: number;
  mandi: string;
  commodity_id: number;
  commodity?: string | null;
  modal_price: number;
  arrival_qty: number | null;
  trend_7d: number[];
  date: string;
}

export interface Section<T> {
  status: "ok" | "stale" | "empty" | "failed";
  data: T;
  error?: string;
}

export interface WeatherData {
  current: {
    temp_c: number;
    condition: string;
    humidity: number;
    wind_kph: number;
  };
  daily: {
    date: string;
    min_c: number;
    max_c: number;
    condition: string;
    rain_mm: number;
  }[];
  source_url: string;
  fetched_at: string;
}

export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  url: string;
  image_url: string;
  video_url: string | null;
  publisher: string;
  published_at: string;
  scraped_at: string;
  collector: string;
  source_url?: string;
}

export interface FertilizerItem {
  product: string;
  price: number;
  unit: string;
  price_per_kg: number | null;
  delta_pct: number | null;
  source_url: string;
  scraped_at: string | null;
}

export interface KnowledgeItem {
  commodity: string;
  sowing_window: string;
  harvest_window: string;
  districts: string[];
  notes: string | null;
}

export interface StateBundle {
  state: StateHeader;
  top_mandis: TopMandi[];
  weather: Section<WeatherData>;
  news: Section<NewsItem[]>;
  fertilizer: Section<FertilizerItem[]>;
  knowledge: Section<KnowledgeItem[]>;
}

/* ------------------------------------------------------------------ */
/*  Dynamic metadata                                                   */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = Number(params.id);
  try {
    const bundle = await apiFetch<StateBundle>(`/api/state/${id}`, {
      cache: "no-store",
    });
    return {
      title: `${bundle.state.name} — CropRoute`,
      description: `Mandi prices, weather, news and crop knowledge for ${bundle.state.name}.`,
    };
  } catch {
    return { title: "State — CropRoute" };
  }
}

/* ------------------------------------------------------------------ */
/*  Server component                                                   */
/* ------------------------------------------------------------------ */

export default async function StatePage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);

  let bundle: StateBundle | null = null;
  let error: string | null = null;

  try {
    bundle = await apiFetch<StateBundle>(`/api/state/${id}`, {
      cache: "no-store",
    });
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load state data";
  }

  return <StateClient initialBundle={bundle} initialError={error} />;
}

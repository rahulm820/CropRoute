import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import type { SearchResponse } from "@/components";
import ResultsClient from "./ResultsClient";

/* ------------------------------------------------------------------ */
/*  Dynamic metadata for SEO                                           */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: { item: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const item = decodeURIComponent(params.item);
  const title = `${item.charAt(0).toUpperCase() + item.slice(1)} prices across India — CropRoute`;
  return {
    title,
    description: `Compare ${item} prices and arrivals across Indian mandis and states. Real-time wholesale market intelligence.`,
  };
}

/* ------------------------------------------------------------------ */
/*  Server component: fetch data via lib/api.ts, pass to client        */
/* ------------------------------------------------------------------ */

export default async function ResultsPage({ params }: PageProps) {
  const item = decodeURIComponent(params.item);

  let data: SearchResponse | null = null;
  let error: string | null = null;

  try {
    data = await apiFetch<SearchResponse>("/api/search", {
      params: { item },
      cache: "no-store",
    });
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Failed to fetch search results";
  }

  return <ResultsClient item={item} initialData={data} initialError={error} />;
}

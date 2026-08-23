"use client";

import { useState } from "react";
import { NewsCard, ProvenanceChip, EmptyState, ErrorState } from "@/components";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FeedItem {
  kind: "post" | "news";
  id: number;
  // post fields
  author?: string;
  state?: string;
  commodity?: string;
  price?: number;
  note?: string;
  image_url?: string;
  created_at?: string;
  // news fields
  title?: string;
  publisher?: string;
  url?: string;
  video_url?: string | null;
  source_url?: string;
  scraped_at?: string;
}

/* ------------------------------------------------------------------ */
/*  FeedClient                                                         */
/* ------------------------------------------------------------------ */

export default function FeedClient({
  initialItems,
  initialError,
}: {
  initialItems: FeedItem[];
  initialError: string | null;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "news">("all");

  const items = initialItems.filter(
    (item) => typeFilter === "all" || item.kind === typeFilter
  );

  return (
    <main className="max-w-content mx-auto px-4 py-6">
      <h1 className="text-[28px] font-semibold text-text mb-4">Feed</h1>

      {/* Filter bar */}
      <div className="flex gap-2 mb-6">
        {(["all", "post", "news"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-card text-[13px] font-medium transition-colors ${
              typeFilter === t
                ? "bg-brand text-white"
                : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {t === "all" ? "All" : t === "post" ? "Farmer Reports" : "Agri News"}
          </button>
        ))}
      </div>

      {initialError && (
        <div className="mb-6">
          <ErrorState message="Could not load feed" fallback={initialError} />
        </div>
      )}

      {!initialError && items.length === 0 && (
        <EmptyState
          icon={<FeedIcon />}
          message={
            typeFilter === "all"
              ? "No items in the feed yet"
              : typeFilter === "post"
                ? "No farmer reports yet"
                : "No news articles yet"
          }
        />
      )}

      <div className="space-y-4">
        {items.map((item) =>
          item.kind === "post" ? (
            <PostCard key={`post-${item.id}`} item={item} />
          ) : (
            <NewsCard
              key={`news-${item.id}`}
              item={{
                id: item.id,
                title: item.title || "",
                summary: "",
                image_url: item.image_url || "",
                video_url: item.video_url || null,
                publisher: item.publisher || "",
                url: item.url || "",
                published_at: item.scraped_at || "",
                scraped_at: item.scraped_at || "",
                collector: "punjab_agri_news",
              }}
            />
          )
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Post card (UGC -- "unverified" badge, no provenance chip)          */
/* ------------------------------------------------------------------ */

function PostCard({ item }: { item: FeedItem }) {
  return (
    <article className="bg-surface border border-border rounded-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-medium rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Farmer Report
            </span>
            <span className="text-[12px] text-text-muted">
              {item.author} &middot; {item.state}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-text">{item.commodity}</span>
            <span className="text-[18px] font-semibold tabular-nums text-text">
              ₹{(item.price || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] text-text-muted">/ quintal</span>
          </div>
          {item.note && (
            <p className="text-[13px] text-text-muted mt-1">{item.note}</p>
          )}
        </div>
        <span className="text-[11px] text-text-muted whitespace-nowrap">
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
        </span>
      </div>
    </article>
  );
}

function FeedIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" />
    </svg>
  );
}

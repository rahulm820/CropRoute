"use client";

import { useState } from "react";
import ProvenanceChip from "./ProvenanceChip";

/**
 * Data shape matching GET /api/state/:id/news from docs/API.md exactly.
 */
export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  image_url: string;
  video_url: string | null;
  publisher: string;
  url: string;
  published_at: string;
  scraped_at: string;
  collector: string;
}

interface NewsCardProps {
  item: NewsItem;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Extract YouTube video ID from various URL formats.
 * Returns null if the URL is not a YouTube link.
 */
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "www.youtube-nocookie.com" ||
      u.hostname === "youtube-nocookie.com"
    ) {
      // /watch?v=ID or /embed/ID
      const v = u.searchParams.get("v");
      if (v) return v;
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments[0] === "embed" && segments[1]) return segments[1];
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1) || null;
    }
  } catch {
    /* not a valid URL */
  }
  return null;
}

/**
 * Extract Vimeo video ID from various URL formats.
 * Returns null if the URL is not a Vimeo link.
 */
function getVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (
      u.hostname === "vimeo.com" ||
      u.hostname === "www.vimeo.com" ||
      u.hostname === "player.vimeo.com"
    ) {
      const segments = u.pathname.split("/").filter(Boolean);
      // /video/ID or just /ID
      const id = segments[segments.length - 1];
      if (id && /^\d+$/.test(id)) return id;
    }
  } catch {
    /* not a valid URL */
  }
  return null;
}

/**
 * Check if a video_url is a direct file (mp4, webm, etc.) rather than
 * a platform embed URL.
 */
function isDirectVideoFile(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov)$/.test(pathname);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Broken-image placeholder                                           */
/* ------------------------------------------------------------------ */

function ImagePlaceholder() {
  return (
    <div className="news-card-placeholder" aria-hidden="true">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media section                                                      */
/* ------------------------------------------------------------------ */

function MediaSection({
  item,
  imageBroken,
  onImageError,
}: {
  item: NewsItem;
  imageBroken: boolean;
  onImageError: () => void;
}) {
  const { video_url, image_url, title } = item;

  // --- Video variant ---
  if (video_url) {
    const youtubeId = getYouTubeId(video_url);
    const vimeoId = getVimeoId(video_url);

    if (youtubeId) {
      return (
        <div className="news-card-media">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }

    if (vimeoId) {
      return (
        <div className="news-card-media">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?dnt=1`}
            title={title}
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }

    if (isDirectVideoFile(video_url)) {
      return (
        <div className="news-card-media">
          <video
            controls
            preload="metadata"
            poster={image_url}
          >
            <source src={video_url} />
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    // Unknown video platform — fall through to image
  }

  // --- Image-only variant ---
  // Note: when video_url is null this is the only path, and no video-sized
  // space is reserved — the media section only renders if we have a valid image.
  if (imageBroken) {
    return (
      <div className="news-card-media">
        <ImagePlaceholder />
      </div>
    );
  }

  return (
    <div className="news-card-media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image_url}
        alt={title}
        loading="lazy"
        onError={onImageError}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/**
 * NewsCard — image or video, headline, summary, publisher, provenance chip.
 *
 * - Video variant: YouTube/Vimeo via privacy-mode iframe, direct files via
 *   native <video>. Never autoplay with sound.
 * - Image-only variant: no reserved video space.
 * - Broken image: clean placeholder, not browser broken-image icon.
 * - ProvenanceChip on every card.
 * - Shows only headline + short summary + link + thumbnail per DATA-SOURCES.md.
 */
export default function NewsCard({ item }: NewsCardProps) {
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <article className="news-card" id={`news-card-${item.id}`}>
      <MediaSection
        item={item}
        imageBroken={imageBroken}
        onImageError={() => setImageBroken(true)}
      />

      <div className="news-card-body">
        <h3 className="news-card-headline">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
        </h3>

        {item.summary && (
          <p className="news-card-summary">{item.summary}</p>
        )}

        <p className="news-card-publisher">{item.publisher}</p>
      </div>

      <div className="news-card-footer">
        <ProvenanceChip
          sourceUrl={item.url}
          scrapedAt={item.scraped_at}
          collectorName={item.collector}
        />
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Default demo video URL if none provided via props.
 * Modify this constant or pass `videoUrl` prop to update.
 */
export const DEFAULT_DEMO_VIDEO_URL =
  "https://youtu.be/nYrOI-zp840";

interface DeploymentNoticeModalProps {
  /** Optional video URL to override default demo tour video. */
  videoUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Video URL Helpers (reused pattern from NewsCard.tsx)              */
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
/* Video Player Component                                              */
/* ------------------------------------------------------------------ */

function NoticeVideoEmbed({ url, title }: { url: string; title: string }) {
  const youtubeId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    return (
      <div className="notice-modal-media">
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
      <div className="notice-modal-media">
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

  if (isDirectVideoFile(url)) {
    return (
      <div className="notice-modal-media">
        <video controls preload="metadata">
          <source src={url} />
          Your browser does not support the video element.
        </video>
      </div>
    );
  }

  // Generic iframe fallback for other embed URLs
  return (
    <div className="notice-modal-media">
      <iframe
        src={url}
        title={title}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Notice Modal Component                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "cropRoute-notice-dismissed";

export default function DeploymentNoticeModal({
  videoUrl = DEFAULT_DEMO_VIDEO_URL,
}: DeploymentNoticeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Check sessionStorage on mount (hydration safe)
  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        triggerRef.current = document.activeElement;
        setIsOpen(true);
      }
    } catch {
      // In case sessionStorage is blocked by browser policy
    }
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore storage errors */
    }
    setIsOpen(false);
  }, []);

  // Focus management: focus dismiss button on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        dismissButtonRef.current?.focus();
      });
    } else if (mounted) {
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen, mounted]);

  // Keyboard shortcut: Escape dismisses
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDismiss]);

  // Focus trap inside modal
  useEffect(() => {
    if (!isOpen) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), video[controls], iframe, [tabindex]:not([tabindex="-1"])'
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

  // Do not render anything on server pass or if dismissed
  if (!mounted || !isOpen) return null;

  return (
    <div
      className="notice-modal-backdrop"
      onClick={handleDismiss}
      aria-hidden="false"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deployment-notice-title"
        aria-describedby="deployment-notice-desc"
        className="notice-modal-card p-6 gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-accent-soft text-accent shrink-0 mt-0.5">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h2
                id="deployment-notice-title"
                className="text-[20px] leading-[26px] font-semibold text-text"
              >
                This demo is frontend-only
              </h2>
              <p
                id="deployment-notice-desc"
                className="text-[14px] leading-[20px] text-text-muted mt-1"
              >
                The backend runs locally for this hackathon submission, so live
                search and market data won&apos;t load on this deployed version.
                Watch the video below for the full working product tour.
              </p>
            </div>
          </div>
        </div>

        {/* Video Embed */}
        <NoticeVideoEmbed
          url={videoUrl}
          title="CropRoute Product Tour Video"
        />

        {/* Actions */}
        <div className="flex items-center justify-end pt-1">
          <button
            ref={dismissButtonRef}
            type="button"
            onClick={handleDismiss}
            className="
              px-5 py-2.5 rounded-lg font-medium text-[14px] leading-[20px]
              bg-brand text-white hover:bg-brand-strong
              transition-colors duration-150 ease-out
              focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
              shadow-sm cursor-pointer
            "
          >
            Continue to CropRoute
          </button>
        </div>
      </div>
    </div>
  );
}

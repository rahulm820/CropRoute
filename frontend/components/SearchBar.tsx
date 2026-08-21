"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ErrorState } from "@/components";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Commodity {
  id: number;
  name: string;
  category: string;
}

/* ------------------------------------------------------------------ */
/*  SearchBar                                                          */
/* ------------------------------------------------------------------ */

export default function SearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  /* --- Data fetching state --- */
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* --- Interaction state --- */
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  /* ---- Fetch commodities on mount via lib/api.ts ---- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<Commodity[]>("/api/commodities")
      .then((data) => {
        if (!cancelled) setCommodities(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load commodities",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Filtered suggestions (case-insensitive substring) ---- */
  const suggestions =
    query.trim().length > 0
      ? commodities.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase()),
        )
      : [];

  const showDropdown = open && suggestions.length > 0 && !loading && !error;

  /* ---- Navigation ---- */
  const navigate = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setOpen(false);
      setQuery(trimmed);
      router.push(`/app/results/${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  /* ---- Keyboard handler ---- */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "Enter") {
        e.preventDefault();
        navigate(query);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          navigate(suggestions[activeIndex].name);
        } else {
          navigate(query);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  /* ---- Option id helper (for aria-activedescendant) ---- */
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  /* ---- Render ---- */
  return (
    <div className="relative w-full max-w-[560px]">
      {/* Search input */}
      <div className="relative">
        {/* Search icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        >
          <circle cx="7.5" cy="7.5" r="5.5" />
          <line x1="11.5" y1="11.5" x2="16" y2="16" />
        </svg>

        <input
          ref={inputRef}
          id="search-bar-input"
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            showDropdown && activeIndex >= 0
              ? optionId(activeIndex)
              : undefined
          }
          aria-autocomplete="list"
          aria-label="Search commodities"
          placeholder={loading ? "Loading commodities…" : "Search a commodity — e.g. Wheat, Rice"}
          disabled={loading}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay to allow click on option to register
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          className={`
            w-full pl-10 pr-4 py-3
            bg-surface border border-border
            rounded-card
            text-[14px] leading-[20px] text-text
            placeholder:text-text-muted
            outline-none
            transition-all duration-150 ease-out
            focus:border-brand focus:ring-2 focus:ring-brand/20
            disabled:opacity-60 disabled:cursor-wait
          `}
        />

        {/* Loading indicator (inline shimmer bar under the input) */}
        {loading && (
          <div
            className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full skeleton-shimmer"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Error state — reuse ErrorState inline */}
      {error && (
        <div className="mt-2">
          <ErrorState
            message="Could not load commodities"
            fallback={error}
          />
        </div>
      )}

      {/* Suggestions dropdown */}
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Commodity suggestions"
          className={`
            absolute z-50 w-full mt-1
            bg-surface border border-border
            rounded shadow-card
            max-h-[240px] overflow-y-auto
            py-1
          `}
        >
          {suggestions.map((commodity, index) => (
            <li
              key={commodity.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                // Prevent input blur so we can navigate
                e.preventDefault();
                navigate(commodity.name);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`
                px-3 py-2 cursor-pointer
                text-[14px] leading-[20px] text-text
                transition-colors duration-150 ease-out
                ${
                  index === activeIndex
                    ? "bg-brand-soft"
                    : "hover:bg-brand-soft"
                }
              `}
            >
              <span className="font-medium">{commodity.name}</span>
              <span className="ml-2 text-[12px] text-text-muted">
                {commodity.category}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

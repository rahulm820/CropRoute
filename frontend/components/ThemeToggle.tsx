"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

/**
 * Resolve which effective theme (light or dark) to apply.
 * "system" defers to the user's OS preference.
 */
function resolveEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/**
 * Apply the theme to the document root.
 * Sets data-theme attribute which drives CSS variable overrides.
 */
function applyTheme(theme: Theme) {
  const effective = resolveEffective(theme);
  document.documentElement.setAttribute("data-theme", effective);
}

/**
 * ThemeToggle — dark/light mode toggle.
 *
 * Uses data-theme attribute on <html> to override prefers-color-scheme.
 * Persists to localStorage. An inline script in root layout prevents
 * flash-of-wrong-theme before hydration.
 *
 * Respects 150ms default transition token from UI-DESIGN.md.
 */
export default function ThemeToggle() {
  // Initialize to null — we don't know the theme until mount (hydration safety)
  const [theme, setTheme] = useState<Theme | null>(null);

  // On mount, read from localStorage (or default to "system")
  useEffect(() => {
    const stored = localStorage.getItem("cropRoute-theme") as Theme | null;
    const resolved = stored || "system";
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Listen for system preference changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const handleToggle = () => {
    if (theme === null) return;

    // Cycle: light → dark → system
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

    setTheme(next);
    localStorage.setItem("cropRoute-theme", next);
    applyTheme(next);
  };

  // Don't render anything during SSR / before mount to avoid hydration mismatch
  if (theme === null) return null;

  const effective = resolveEffective(theme);

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Current theme: ${theme}. Click to switch.`}
      title={`Theme: ${theme}`}
      id="theme-toggle"
      className="
        theme-toggle-button
        focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2
      "
    >
      {/* Sun icon (shown in dark mode) */}
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
        className={`theme-toggle-icon ${
          effective === "dark" ? "theme-toggle-icon-active" : ""
        }`}
      >
        <circle cx="8" cy="8" r="3.5" />
        <line x1="8" y1="1" x2="8" y2="2.5" />
        <line x1="8" y1="13.5" x2="8" y2="15" />
        <line x1="1" y1="8" x2="2.5" y2="8" />
        <line x1="13.5" y1="8" x2="15" y2="8" />
        <line x1="3.05" y1="3.05" x2="4.11" y2="4.11" />
        <line x1="11.89" y1="11.89" x2="12.95" y2="12.95" />
        <line x1="3.05" y1="12.95" x2="4.11" y2="11.89" />
        <line x1="11.89" y1="4.11" x2="12.95" y2="3.05" />
      </svg>

      {/* Moon icon (shown in light mode) */}
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
        className={`theme-toggle-icon ${
          effective === "light" ? "theme-toggle-icon-active" : ""
        }`}
      >
        <path d="M14 9.5A6 6 0 0 1 6.5 2C6.5 2 2 3.5 2 8.5S6 14 8.5 14C12 14 14 9.5 14 9.5Z" />
      </svg>

      {/* System icon (monitor) — only visible when in system mode */}
      {theme === "system" && (
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
          className="theme-toggle-icon theme-toggle-icon-active"
        >
          <rect x="1.5" y="2" width="13" height="9" rx="1.5" />
          <line x1="5" y1="14" x2="11" y2="14" />
          <line x1="8" y1="11" x2="8" y2="14" />
        </svg>
      )}
    </button>
  );
}

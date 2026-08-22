"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Navigation link definition.
 * `match` is a function that returns true when the route is active.
 */
interface NavItem {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Search / Results",
    href: "/app/results/wheat",
    match: (p) => p.startsWith("/app/results"),
  },
  {
    label: "Collectors",
    href: "/app/collectors",
    match: (p) => p.startsWith("/app/collectors"),
  },
  {
    label: "State",
    href: "/app/state",
    match: (p) => p.startsWith("/app/state"),
  },
];

/**
 * AppLayout — persistent shell for all /app/* routes.
 *
 * Top nav bar with:
 *   - Logo/wordmark (text)
 *   - Primary nav links with active route indication
 *     (underline + font-weight + color — accessible, not color-only)
 *   - ThemeToggle (relocated from root layout's fixed-position overlay)
 *
 * Responsive: collapses to hamburger on narrow viewports.
 * Full keyboard path: all nav links are real focusable elements
 * with visible focus rings (2px brand, 2px offset).
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Close mobile menu on click outside
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* ---- Top navigation bar ---- */}
      <nav className="app-nav" aria-label="Primary navigation">
        <div className="app-nav-inner">
          {/* Logo / wordmark */}
          <Link href="/app/results/wheat" className="app-nav-logo" id="nav-logo">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="app-nav-logo-icon"
            >
              <path d="M12 22C12 22 4 16 4 10C4 6 7 2 12 2C17 2 20 6 20 10C20 16 12 22 12 22Z" />
              <path d="M12 2V14" />
              <path d="M8 6C10 8 12 10 12 14" />
              <path d="M16 6C14 8 12 10 12 14" />
            </svg>
            <span className="app-nav-logo-text">CropRoute</span>
          </Link>

          {/* Desktop nav links */}
          <ul className="app-nav-links" role="list">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`app-nav-link ${active ? "app-nav-link-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    id={`nav-${item.label.toLowerCase().replace(/[\s/]/g, "-")}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right side: ThemeToggle + hamburger */}
          <div className="app-nav-actions">
            <ThemeToggle />

            {/* Hamburger — visible on narrow viewports only */}
            <button
              ref={buttonRef}
              type="button"
              className="app-nav-hamburger"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="app-mobile-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              id="nav-hamburger"
            >
              <span className={`app-hamburger-bar ${menuOpen ? "app-hamburger-bar-open" : ""}`} />
              <span className={`app-hamburger-bar ${menuOpen ? "app-hamburger-bar-open" : ""}`} />
              <span className={`app-hamburger-bar ${menuOpen ? "app-hamburger-bar-open" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div
          ref={menuRef}
          id="app-mobile-menu"
          className={`app-mobile-menu ${menuOpen ? "app-mobile-menu-open" : ""}`}
          role="menu"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-mobile-menu-link ${active ? "app-mobile-menu-link-active" : ""}`}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                id={`nav-mobile-${item.label.toLowerCase().replace(/[\s/]/g, "-")}`}
                tabIndex={menuOpen ? 0 : -1}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ---- Content area ---- */}
      <div className="app-content">
        {children}
      </div>
    </>
  );
}

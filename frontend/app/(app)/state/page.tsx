"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ErrorState } from "@/components";

interface StateRow {
  id: number;
  name: string;
}

/**
 * /state — picker grid for the region intelligence pages.
 * Lists every seeded state and links to its /state/[id] bundle page.
 */
export default function StateIndexPage() {
  const [states, setStates] = useState<StateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StateRow[]>("/api/states")
      .then(setStates)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load states")
      );
  }, []);

  return (
    <main className="max-w-content mx-auto p-6 space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-[32px] leading-[38px] font-semibold text-text">
          States
        </h1>
        <p className="text-[14px] leading-[20px] text-text-muted mt-1">
          Region intelligence — prices, weather, news and input costs per state
        </p>
      </header>

      {error && <ErrorState message={error} />}

      {!error && states === null && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-card bg-surface border border-border"
            />
          ))}
        </div>
      )}

      {states !== null && (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="States"
        >
          {states.map((s) => (
            <li key={s.id}>
              <Link
                href={`/state/${s.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-card px-4 py-3 text-text hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="text-[14px] font-medium">{s.name}</span>
                <span aria-hidden="true" className="text-text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

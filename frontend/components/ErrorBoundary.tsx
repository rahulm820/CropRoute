"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Card-level error boundary.  Catches render errors in one section and
 * shows a fallback instead of blanking the entire page.
 *
 * Usage:
 *   <ErrorBoundary sectionName="Weather">
 *     <WeatherCard ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.sectionName || "section"}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const section = this.props.sectionName || "Section";
      return (
        <div className="bg-surface border border-border rounded-card p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[13px] font-medium">{section} failed to load</span>
          </div>
          <p className="text-[12px] text-text-muted">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            type="button"
            className="mt-3 text-[12px] text-brand hover:underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

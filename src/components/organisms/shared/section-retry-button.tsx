"use client";

import { RefreshRetryButton } from "@/components/errors/retry-button";
import { QueryRetryButton } from "@/components/views/query-retry-button";

interface SectionRetryButtonProps {
  /** Re-runs a browser-owned load; without it the route's server components are refreshed. */
  onRetry?: () => void;
  /** The caller's load is running again (`useRetryKeepingError`'s `retrying`). */
  isRetrying?: boolean;
}

/** The Retry of a section that failed to load; disabled while it runs so clicks cannot queue more refetches. */
export function SectionRetryButton({
  onRetry,
  isRetrying = false,
}: SectionRetryButtonProps) {
  if (onRetry) {
    return <QueryRetryButton retrying={isRetrying} onRetry={onRetry} />;
  }
  return <RefreshRetryButton />;
}

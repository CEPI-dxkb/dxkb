"use client";

import { RefreshRetryButton } from "@/components/errors/retry-button";
import { QueryRetryButton } from "@/components/views/query-retry-button";

interface SectionRetryButtonProps {
  /**
   * Re-runs a load the browser owns (a query's `refetch`). Without it the
   * route's server components are refreshed, which re-runs a section that
   * failed while the page rendered.
   */
  onRetry?: () => void;
  /** The caller's load is running again (`useRetryKeepingError`'s `retrying`). */
  isRetrying?: boolean;
}

/**
 * The Retry of a section or panel that failed to load. `SectionError` renders
 * it, so a server-rendered section gets a working Retry without becoming a
 * client component itself. Either way the button stays disabled while the
 * retry runs, so repeated clicks cannot queue more refetches or refreshes.
 */
export function SectionRetryButton({
  onRetry,
  isRetrying = false,
}: SectionRetryButtonProps) {
  if (onRetry) {
    return <QueryRetryButton retrying={isRetrying} onRetry={onRetry} />;
  }
  return <RefreshRetryButton />;
}

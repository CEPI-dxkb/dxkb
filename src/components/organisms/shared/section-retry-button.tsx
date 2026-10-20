"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

interface SectionRetryButtonProps {
  /**
   * Re-runs a load the browser owns (a query's `refetch`). Without it the
   * route's server components are refreshed, which re-runs a section that
   * failed while the page rendered.
   */
  onRetry?: () => void;
  /** The caller's load is running again (a query's `isFetching`). */
  isRetrying?: boolean;
}

function RetryButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {busy ? "Retrying…" : "Retry"}
    </Button>
  );
}

function RouteRefreshRetryButton() {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  return (
    <RetryButton
      busy={isRefreshing}
      onClick={() => {
        startRefresh(() => {
          router.refresh();
        });
      }}
    />
  );
}

/**
 * The Retry of a section or panel that failed to load. `SectionError` renders
 * it, so a server-rendered section gets a working Retry without becoming a
 * client component itself.
 */
export function SectionRetryButton({
  onRetry,
  isRetrying = false,
}: SectionRetryButtonProps) {
  if (onRetry) return <RetryButton busy={isRetrying} onClick={onRetry} />;
  return <RouteRefreshRetryButton />;
}

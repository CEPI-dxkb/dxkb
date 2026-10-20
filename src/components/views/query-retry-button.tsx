"use client";

import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QueryRetryButtonProps {
  /** The retry is in flight (`useRetryKeepingError`'s `retrying`). */
  retrying: boolean;
  onRetry: () => void;
  size?: "sm" | "toolbar";
  label?: string;
}

/**
 * The Retry of a failed query, beside the error it keeps on screen: disabled,
 * with a spinner and "Retrying…", until the refetch answers. The query-state
 * twin of `RetryButton` (`src/components/errors/retry-button.tsx`), which
 * tracks a route refresh through a transition instead.
 */
export function QueryRetryButton({
  retrying,
  onRetry,
  size = "sm",
  label = "Retry",
}: QueryRetryButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={retrying}
      aria-busy={retrying || undefined}
      onClick={onRetry}
    >
      {retrying ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden="true"
        />
      ) : (
        <RotateCw data-icon="inline-start" aria-hidden="true" />
      )}
      {retrying ? "Retrying…" : label}
    </Button>
  );
}

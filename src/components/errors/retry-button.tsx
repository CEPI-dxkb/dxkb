"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RetryButtonProps {
  /**
   * What a retry runs. An `error.tsx` boundary passes its `retry` prop
   * (refresh, then reset): `reset` alone re-renders the same failed server
   * payload, so a button wired to it never recovers.
   */
  retry: () => void;
  label?: string;
}

/**
 * The Retry of a failed page or record. It runs inside a transition, so the
 * button stays disabled with a spinner until the refetched page commits,
 * instead of looking as if the click did nothing.
 */
export function RetryButton({ retry, label = "Retry" }: RetryButtonProps) {
  const [isRetrying, startRetry] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isRetrying}
      aria-busy={isRetrying || undefined}
      onClick={() => {
        startRetry(() => {
          retry();
        });
      }}
    >
      {isRetrying ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden="true"
        />
      ) : (
        <RotateCw data-icon="inline-start" aria-hidden="true" />
      )}
      {isRetrying ? "Retrying…" : label}
    </Button>
  );
}

/**
 * Retry for a server page that rendered its own error state instead of
 * throwing: refreshing the route re-runs its server components.
 */
export function RefreshRetryButton({ label }: { label?: string }) {
  const router = useRouter();
  return (
    <RetryButton
      retry={() => {
        router.refresh();
      }}
      label={label}
    />
  );
}

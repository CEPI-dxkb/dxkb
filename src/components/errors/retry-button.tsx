"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RetryButtonProps {
  /**
   * An `error.tsx` boundary passes its `retry` prop: `reset` alone re-renders
   * the same failed server payload.
   */
  retry: () => void;
  label?: string;
}

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

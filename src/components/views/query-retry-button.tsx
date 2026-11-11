"use client";

import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QueryRetryButtonProps {
  retrying: boolean;
  onRetry: () => void;
  size?: "sm" | "toolbar";
  label?: string;
}

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

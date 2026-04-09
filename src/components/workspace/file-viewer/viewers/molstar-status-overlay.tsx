"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ViewerStatus } from "./use-molstar-plugin";

interface MolstarStatusOverlayProps {
  status: ViewerStatus;
  errorMessage: string | undefined;
  onRetry: () => void;
  compact?: boolean;
}

export function MolstarStatusOverlay({
  status,
  errorMessage,
  onRetry,
  compact,
}: MolstarStatusOverlayProps) {
  if (status === "loading" || status === "initializing") {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
        <Spinner className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {status === "loading"
            ? "Loading viewer\u2026"
            : "Initializing structure\u2026"}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle
            className={compact ? "h-8 w-8 text-destructive" : "h-10 w-10 text-destructive"}
          />
          <p
            className={
              compact
                ? "max-w-xs text-sm text-muted-foreground"
                : "max-w-sm text-sm text-muted-foreground"
            }
          >
            {errorMessage}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}

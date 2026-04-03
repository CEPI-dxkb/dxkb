"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ExpandableViewerWrapper } from "./expandable-viewer-wrapper";
import {
  useMolstarPlugin,
  type MolstarLayoutSpec,
} from "./use-molstar-plugin";

interface StructureViewerProps {
  filePath: string;
  fileName: string;
}

const embeddedLayout: MolstarLayoutSpec = {
  showControls: false,
  regionState: "hidden",
};

export function StructureViewer({ filePath, fileName }: StructureViewerProps) {
  const { containerRef, status, errorMessage, resetError } = useMolstarPlugin(
    filePath,
    embeddedLayout,
  );

  return (
    <ExpandableViewerWrapper title={fileName}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-b-lg">
        <div
          ref={containerRef}
          className="isolate relative min-h-0 flex-1 overflow-hidden"
          data-testid="molstar-container"
        />
        {(status === "loading" || status === "initializing") && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <Spinner className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {status === "loading"
                ? "Loading viewer\u2026"
                : "Initializing structure\u2026"}
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="max-w-xs text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetError}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </ExpandableViewerWrapper>
  );
}

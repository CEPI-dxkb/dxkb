"use client";

import { use } from "react";
import { ArrowLeft, Cuboid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { safeDecode } from "@/lib/url";
import { MolstarStatusOverlay } from "@/components/workspace/file-viewer/viewers/molstar-status-overlay";
import {
  useMolstarPlugin,
  type MolstarLayoutSpec,
} from "@/components/workspace/file-viewer/viewers/use-molstar-plugin";

interface StructurePageProps {
  params: Promise<{ path?: string[] }>;
}

const fullLayout: MolstarLayoutSpec = {
  showControls: true,
  regionState: "full",
};

export default function StructureViewerPage({ params }: StructurePageProps) {
  const { path } = use(params);
  const filePath = path ? `/${path.map(safeDecode).join("/")}` : "";
  const fileName = filePath.split("/").filter(Boolean).pop() ?? "";

  const { containerRef, status, errorMessage, resetError } = useMolstarPlugin(
    filePath,
    fullLayout,
  );

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No file path provided.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-4 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.close();
            }
          }}
          title="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2 overflow-hidden">
          <Cuboid className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{fileName}</span>
        </div>
      </div>

      <Separator />

      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className="h-full w-full"
          data-testid="molstar-container"
        />
        <MolstarStatusOverlay
          status={status}
          errorMessage={errorMessage}
          onRetry={resetError}
        />
      </div>
    </div>
  );
}

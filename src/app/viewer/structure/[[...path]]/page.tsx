"use client";

import { use } from "react";
import { ArrowLeft, Cuboid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildWorkspaceStructureSource } from "@/lib/protein-structure-view/source";
import { readRouteParamSegments } from "@/lib/views/route-params";
import { StructureSourceViewer } from "@/components/workspace/file-viewer/viewers/structure-source-viewer";
import type { MolstarLayoutSpec } from "@/components/workspace/file-viewer/viewers/use-molstar-plugin";

interface StructurePageProps {
  params: Promise<{ path?: string[] }>;
}

const fullLayout: MolstarLayoutSpec = {
  showControls: true,
  regionState: "full",
};

export default function StructureViewerPage({ params }: StructurePageProps) {
  // A catch-all param arrives percent-encoded per segment;
  // `readRouteParamSegments` undoes it (`generateMetadata` and route handlers
  // must not).
  const { path } = use(params);
  const filePath = readRouteParamSegments(path ?? [], "page").join("/");
  const source = filePath ? buildWorkspaceStructureSource(filePath) : undefined;

  if (!source) {
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
          <ArrowLeft className="size-4" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2 overflow-hidden">
          <Cuboid className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{source.label}</span>
        </div>
      </div>

      <Separator />

      <div className="relative min-h-0 flex-1">
        {/* `isolate` keeps Mol*'s z-1000+ overlays below the navbar's z-50 popups. */}
        <StructureSourceViewer
          source={source}
          layout={fullLayout}
          containerClassName="isolate size-full"
        />
      </div>
    </div>
  );
}

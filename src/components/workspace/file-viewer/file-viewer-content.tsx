"use client";

import { lazy, Suspense } from "react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { Spinner } from "@/components/ui/spinner";
import { resolveViewer, iframeNeedsScripts } from "./file-viewer-registry";
import { TextViewer } from "./viewers/text-viewer";
import { JsonViewer } from "./viewers/json-viewer";
import { ImageViewer } from "./viewers/image-viewer";
import { SvgViewer } from "./viewers/svg-viewer";
import { CsvViewer } from "./viewers/csv-viewer";
import { IframeViewer } from "./viewers/iframe-viewer";
import { FallbackViewer } from "./viewers/fallback-viewer";

const StructureViewer = lazy(() =>
  import("./viewers/structure-viewer").then((m) => ({
    default: m.StructureViewer,
  })),
);

interface FileViewerContentProps {
  item: WorkspaceBrowserItem;
}

export function FileViewerContent({ item }: FileViewerContentProps) {
  const category = resolveViewer(item.type, item.name);

  switch (category) {
    case "text":
      return (
        <TextViewer
          filePath={item.path}
          fileName={item.name}
          fileSize={item.size}
        />
      );
    case "json":
      return (
        <JsonViewer
          filePath={item.path}
          fileName={item.name}
          fileSize={item.size}
        />
      );
    case "image":
      return <ImageViewer filePath={item.path} fileName={item.name} />;
    case "svg":
      return <SvgViewer filePath={item.path} fileName={item.name} />;
    case "csv":
      return (
        <CsvViewer
          filePath={item.path}
          fileName={item.name}
          fileSize={item.size}
        />
      );
    case "structure":
      return (
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              <span className="text-sm">Loading viewer&hellip;</span>
            </div>
          }
        >
          <StructureViewer filePath={item.path} fileName={item.name} />
        </Suspense>
      );
    case "iframe":
      return <IframeViewer filePath={item.path} allowScripts={iframeNeedsScripts(item.name)} />;
    case "fallback":
      return (
        <FallbackViewer
          fileName={item.name}
          fileType={item.type}
          filePath={item.path}
        />
      );
  }
}

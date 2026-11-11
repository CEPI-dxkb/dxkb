"use client";

import dynamic from "next/dynamic";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { Spinner } from "@/components/ui/spinner";
import { resolveViewer, iframeNeedsScripts } from "./file-viewer-registry";
import { TextViewer } from "./viewers/text-viewer";
import { JsonViewer } from "./viewers/json-viewer";
import { ImageViewer } from "./viewers/image-viewer";
import { SvgViewer } from "./viewers/svg-viewer";
import { IframeViewer } from "./viewers/iframe-viewer";
import { FallbackViewer } from "./viewers/fallback-viewer";

function ViewerLoading() {
  return (
    <div className="flex size-full items-center justify-center">
      <Spinner />
    </div>
  );
}

// csv-parse (and the Buffer polyfill it needs) loads with the first table
// preview, so the workspace browser does not carry it in its first bundle.
const CsvViewer = dynamic(
  () => import("./viewers/csv-viewer").then((module) => module.CsvViewer),
  { ssr: false, loading: ViewerLoading },
);

interface FileViewerContentProps {
  item: WorkspaceItem;
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

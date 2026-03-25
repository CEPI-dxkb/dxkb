"use client";

import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { resolveViewer, largeSizeThreshold } from "./file-viewer-registry";
import { TextViewer } from "./viewers/text-viewer";
import { JsonViewer } from "./viewers/json-viewer";
import { ImageViewer } from "./viewers/image-viewer";
import { CsvViewer } from "./viewers/csv-viewer";
import { IframeViewer } from "./viewers/iframe-viewer";
import { FallbackViewer } from "./viewers/fallback-viewer";

interface FileViewerContentProps {
  item: WorkspaceBrowserItem;
}

export function FileViewerContent({ item }: FileViewerContentProps) {
  const category =
    item.size > largeSizeThreshold
      ? "iframe"
      : resolveViewer(item.type, item.name);

  switch (category) {
    case "text":
      return <TextViewer filePath={item.path} fileName={item.name} />;
    case "json":
      return <JsonViewer filePath={item.path} fileName={item.name} />;
    case "image":
      return <ImageViewer filePath={item.path} fileName={item.name} />;
    case "csv":
      return <CsvViewer filePath={item.path} fileName={item.name} />;
    case "iframe":
      return <IframeViewer filePath={item.path} />;
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

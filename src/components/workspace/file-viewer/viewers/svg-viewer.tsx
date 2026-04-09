"use client";

import { useState } from "react";
import { Code, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProxyUrl } from "../file-viewer-registry";
import { TextViewer } from "./text-viewer";
import { ZoomableImage } from "./zoomable-image";

interface SvgViewerProps {
  filePath: string;
  fileName: string;
}

export function SvgViewer({ filePath, fileName }: SvgViewerProps) {
  const [viewMode, setViewMode] = useState<"image" | "code">("image");

  const modeToggle = (
    <>
      <Button
        variant={viewMode === "image" ? "default" : "ghost"}
        size="sm"
        onClick={() => setViewMode("image")}
      >
        <ImageIcon className="mr-1 h-4 w-4" />
        Image
      </Button>
      <Button
        variant={viewMode === "code" ? "default" : "ghost"}
        size="sm"
        onClick={() => setViewMode("code")}
      >
        <Code className="mr-1 h-4 w-4" />
        Code
      </Button>
    </>
  );

  if (viewMode === "code") {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          {modeToggle}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <TextViewer filePath={filePath} fileName={fileName} />
        </div>
      </div>
    );
  }

  return (
    <ZoomableImage
      src={getProxyUrl(filePath)}
      alt={fileName}
      toolbarLeading={modeToggle}
    />
  );
}

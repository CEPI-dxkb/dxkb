"use client";

import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProxyUrl } from "../file-viewer-registry";

interface FallbackViewerProps {
  fileName: string;
  fileType: string;
  filePath: string;
}

export function FallbackViewer({
  fileName,
  fileType,
  filePath,
}: FallbackViewerProps) {
  function handleDownload() {
    const anchor = document.createElement("a");
    anchor.href = getProxyUrl(filePath);
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <p>No viewer available for this file type</p>
      <span className="text-sm text-muted-foreground">Type: {fileType}</span>
      <Button variant="outline" onClick={handleDownload}>
        Download
      </Button>
    </div>
  );
}

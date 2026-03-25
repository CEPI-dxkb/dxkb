"use client";

import { getProxyUrl } from "../file-viewer-registry";

interface IframeViewerProps {
  filePath: string;
}

export function IframeViewer({ filePath }: IframeViewerProps) {
  const fileName = filePath.split("/").filter(Boolean).pop() ?? filePath;

  return (
    <iframe
      src={getProxyUrl(filePath)}
      sandbox="allow-same-origin"
      className="h-full w-full border-0"
      title={fileName}
    />
  );
}

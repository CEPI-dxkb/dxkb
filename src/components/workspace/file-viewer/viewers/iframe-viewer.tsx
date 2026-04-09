"use client";

import { getProxyUrl } from "../file-viewer-registry";

interface IframeViewerProps {
  filePath: string;
  allowScripts?: boolean;
}

export function IframeViewer({ filePath, allowScripts = false }: IframeViewerProps) {
  const fileName = filePath.split("/").filter(Boolean).pop() ?? filePath;

  return (
    <iframe
      src={getProxyUrl(filePath)}
      sandbox={allowScripts ? "allow-scripts" : "allow-same-origin"}
      className="h-full w-full border-0"
      title={fileName}
    />
  );
}

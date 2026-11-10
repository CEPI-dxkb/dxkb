"use client";

import { getProxyUrl } from "../file-viewer-registry";

interface IframeViewerProps {
  filePath: string;
  allowScripts?: boolean;
}

// Chrome's PDF viewer cannot render inside any sandboxed iframe, so PDFs from our
// same-origin proxy omit sandbox entirely.
function getSandbox(fileName: string, allowScripts: boolean): string | undefined {
  if (fileName.toLowerCase().endsWith(".pdf")) return undefined;
  return allowScripts ? "allow-scripts" : "allow-same-origin";
}

export function IframeViewer({ filePath, allowScripts = false }: IframeViewerProps) {
  const fileName = filePath.split("/").filter(Boolean).pop() ?? filePath;

  return (
    <iframe
      src={getProxyUrl(filePath)}
      sandbox={getSandbox(fileName, allowScripts)}
      className="size-full border-0"
      title={fileName}
    />
  );
}

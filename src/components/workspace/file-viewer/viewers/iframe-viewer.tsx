"use client";

import { getProxyUrl } from "../file-viewer-registry";

interface IframeViewerProps {
  filePath: string;
  allowScripts?: boolean;
}

// Chrome's built-in PDF viewer cannot render inside any sandboxed iframe,
// regardless of which sandbox tokens are set. Omit sandbox entirely for PDFs
// served from our own same-origin proxy — PDF binary content carries no JS risk.
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
      className="h-full w-full border-0"
      title={fileName}
    />
  );
}

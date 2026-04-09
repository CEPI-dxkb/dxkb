"use client";

import { previewMaxBytes } from "../file-viewer-registry";
import { CodeMirrorViewer } from "./codemirror-viewer";

interface JsonViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
}

export function JsonViewer({ filePath, fileName, fileSize }: JsonViewerProps) {
  const isLargeFile = !!(fileSize && fileSize > previewMaxBytes);

  return (
    <CodeMirrorViewer
      filePath={filePath}
      fileName={fileName}
      fileSize={fileSize}
      foldable
      startFolded={isLargeFile}
    />
  );
}

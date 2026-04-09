"use client";

import { CodeMirrorViewer } from "./codemirror-viewer";

interface TextViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
}

export function TextViewer({ filePath, fileName, fileSize }: TextViewerProps) {
  return (
    <CodeMirrorViewer
      filePath={filePath}
      fileName={fileName}
      fileSize={fileSize}
    />
  );
}

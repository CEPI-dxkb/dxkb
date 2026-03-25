"use client";

import { getProxyUrl } from "../file-viewer-registry";
import { ZoomableImage } from "./zoomable-image";

interface ImageViewerProps {
  filePath: string;
  fileName: string;
}

export function ImageViewer({ filePath, fileName }: ImageViewerProps) {
  return <ZoomableImage src={getProxyUrl(filePath)} alt={fileName} />;
}

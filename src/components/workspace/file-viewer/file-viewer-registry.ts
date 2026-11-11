import { buildEncodedSegmentPath, parsePathSegments } from "@/lib/services/workspace/path-utils";

export type ViewerCategory =
  | "text"
  | "json"
  | "image"
  | "svg"
  | "csv"
  | "iframe"
  | "fallback";

const typeToViewer: Partial<Record<string, ViewerCategory>> = {
  txt: "text",
  gff: "text",
  aligned_dna_fasta: "text",
  aligned_protein_fasta: "text",
  feature_dna_fasta: "text",
  feature_protein_fasta: "text",
  vcf: "text",
  nwk: "text",
  xml: "text",
  json: "json",
  svg: "svg",
  png: "image",
  jpg: "image",
  gif: "image",
  csv: "csv",
  tsv: "csv",
  diffexp_input_data: "csv",
  diffexp_input_metadata: "csv",
  html: "iframe",
  pdf: "iframe",
  pdb: "text",
  diffexp_experiment: "iframe",
  diffexp_expression: "iframe",
  diffexp_mapping: "iframe",
  diffexp_sample: "iframe",
};

const extensionToViewer: Partial<Record<string, ViewerCategory>> = {
  ".txt": "text",
  ".log": "text",
  ".fa": "text",
  ".fasta": "text",
  ".faa": "text",
  ".fna": "text",
  ".gff": "text",
  ".xmfa": "text",
  ".vcf": "text",
  ".nwk": "text",
  ".xml": "text",
  ".afa": "text",
  ".gfa": "text",
  ".json": "json",
  ".svg": "svg",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".csv": "csv",
  ".tsv": "csv",
  ".html": "iframe",
  ".htm": "iframe",
  ".pdf": "iframe",
  ".pdb": "text",
};

const mimeMap: Record<string, string> = {
  ".txt": "text/plain",
  ".log": "text/plain",
  ".fa": "text/plain",
  ".fasta": "text/plain",
  ".faa": "text/plain",
  ".fna": "text/plain",
  ".gff": "text/plain",
  ".xmfa": "text/plain",
  ".vcf": "text/plain",
  ".nwk": "text/plain",
  ".afa": "text/plain",
  ".gfa": "text/plain",
  ".json": "application/json",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".html": "text/html",
  ".htm": "text/html",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".xml": "text/xml",
  ".pdb": "chemical/x-pdb",
};

export const previewMaxBytes = 10 * 1024 * 1024;

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "";
  return fileName.slice(dot).toLowerCase();
}

/**
 * File extension wins over workspace type, which is often generic (e.g. an SVG stored
 * as "txt").
 */
export function resolveViewer(
  workspaceType: string,
  fileName: string,
): ViewerCategory {
  const ext = getExtension(fileName);

  const byExt = extensionToViewer[ext];
  if (byExt) return byExt;

  const byType = typeToViewer[workspaceType];
  if (byType) return byType;

  return "fallback";
}

export function isViewableType(
  workspaceType: string,
  fileName: string,
): boolean {
  return resolveViewer(workspaceType, fileName) !== "fallback";
}

export function isStructureFile(fileName: string): boolean {
  return getExtension(fileName) === ".pdb";
}

export function getStructureViewerUrl(filePath: string): string {
  return `/viewer/structure/${encodePath(filePath)}`;
}

export function getMimeType(fileName: string): string {
  const ext = getExtension(fileName);
  return mimeMap[ext] ?? "application/octet-stream";
}

function encodePath(filePath: string): string {
  return buildEncodedSegmentPath(parsePathSegments(filePath));
}

export function iframeNeedsScripts(fileName: string): boolean {
  const ext = getExtension(fileName);
  return ext === ".pdf" || ext === ".html" || ext === ".htm";
}

export function getProxyUrl(filePath: string): string {
  return `/api/workspace/view/${encodePath(filePath)}`;
}

/** The server rounds the preview down to the last newline. */
export function getPreviewUrl(
  filePath: string,
  maxBytes: number = previewMaxBytes,
): string {
  return `/api/workspace/preview/${encodePath(filePath)}?maxBytes=${String(maxBytes)}`;
}


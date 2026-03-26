/**
 * Maps workspace file types and extensions to viewer categories.
 * Pure utility — no React dependencies.
 */

import { buildEncodedSegmentPath, parsePathSegments } from "@/lib/utils";

export type ViewerCategory =
  | "text"
  | "json"
  | "image"
  | "svg"
  | "csv"
  | "iframe"
  | "fallback";

// ---------------------------------------------------------------------------
// Workspace object type -> viewer
// ---------------------------------------------------------------------------

const typeToViewer: Record<string, ViewerCategory> = {
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
  pdb: "iframe",
  diffexp_experiment: "iframe",
  diffexp_expression: "iframe",
  diffexp_mapping: "iframe",
  diffexp_sample: "iframe",
};

// ---------------------------------------------------------------------------
// File extension -> viewer
// ---------------------------------------------------------------------------

const extensionToViewer: Record<string, ViewerCategory> = {
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
  ".pdb": "iframe",
};

// ---------------------------------------------------------------------------
// Extension -> MIME type
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Preview constants
// ---------------------------------------------------------------------------

export const previewMaxBytes = 10 * 1024 * 1024; // 10 MB — shared limit for preview endpoint and interactive viewer threshold

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "";
  return fileName.slice(dot).toLowerCase();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine which viewer category should handle a given workspace item.
 *
 * Resolution order:
 *  1. File extension (`extensionToViewer`) — checked first because workspace
 *     types are often generic (e.g. an SVG stored as type "txt")
 *  2. Workspace object type (`typeToViewer`)
 *  3. "fallback"
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

/**
 * Returns `true` when the file can be rendered by any viewer other than the
 * fallback placeholder.
 */
export function isViewableType(
  workspaceType: string,
  fileName: string,
): boolean {
  return resolveViewer(workspaceType, fileName) !== "fallback";
}

/**
 * Best-guess MIME type for a file name. Falls back to
 * `application/octet-stream` for unknown extensions.
 */
export function getMimeType(fileName: string): string {
  const ext = getExtension(fileName);
  return mimeMap[ext] ?? "application/octet-stream";
}

function encodePath(filePath: string): string {
  return buildEncodedSegmentPath(parsePathSegments(filePath));
}

/**
 * Returns `true` when an iframe-rendered file needs `allow-scripts` in its
 * sandbox (e.g. PDF viewer plugin, HTML with embedded JS).
 */
export function iframeNeedsScripts(fileName: string): boolean {
  const ext = getExtension(fileName);
  return ext === ".pdf" || ext === ".html" || ext === ".htm";
}

/**
 * Build an API proxy URL for streaming a workspace file, encoding each path
 * segment individually so slashes are preserved.
 */
export function getProxyUrl(filePath: string): string {
  return `/api/workspace/view/${encodePath(filePath)}`;
}

/**
 * Build a preview API URL that returns only the first `maxBytes` bytes of a
 * workspace file (rounded down to the last newline by the server).
 */
export function getPreviewUrl(
  filePath: string,
  maxBytes: number = previewMaxBytes,
): string {
  return `/api/workspace/preview/${encodePath(filePath)}?maxBytes=${maxBytes}`;
}


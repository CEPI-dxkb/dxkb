import {
  fastaAcceptTypes,
  fastaContentType,
  type FastaResource,
  type FastaSequenceType,
} from "./fasta";
import { safeFileNameBase } from "./file-name";
import type { DataResource, DataSort } from "./types";

/**
 * Table download contract shared by the tile, the gateway route and
 * `ServerDataRepository.download()`. Browser-safe and dependency-free.
 */

export const tableDownloadFormatIds = ["tsv", "csv", "xlsx"] as const;
export const sequenceDownloadFormatIds = ["dna-fasta", "protein-fasta"] as const;
export const downloadFormatIds = [
  ...tableDownloadFormatIds,
  ...sequenceDownloadFormatIds,
] as const;

export type TableDownloadFormatId = (typeof tableDownloadFormatIds)[number];
export type SequenceDownloadFormatId =
  (typeof sequenceDownloadFormatIds)[number];
export type DownloadFormatId = (typeof downloadFormatIds)[number];

export interface DownloadFormat {
  label: string;
  tag: string;
  description: string;
  accept: string;
  contentType: string;
  extension: string;
  kind: "table" | "sequence";
}

/**
 * The gateway relabels the upstream's content types with the type the saved
 * file should carry.
 */
export const downloadFormats: Record<DownloadFormatId, DownloadFormat> = {
  tsv: {
    label: "Text",
    tag: "TXT",
    description: "Tab-delimited",
    accept: "text/tsv",
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
    kind: "table",
  },
  csv: {
    label: "CSV",
    tag: "CSV",
    description: "Comma-separated",
    accept: "text/csv",
    contentType: "text/csv; charset=utf-8",
    extension: "csv",
    kind: "table",
  },
  xlsx: {
    label: "Excel",
    tag: "XLSX",
    description: "Spreadsheet",
    accept: "application/vnd.openxmlformats",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    kind: "table",
  },
  "dna-fasta": {
    label: "DNA FASTA",
    tag: "FNA",
    description: "Nucleotide sequences",
    accept: fastaAcceptTypes.dna,
    contentType: `${fastaContentType}; charset=utf-8`,
    extension: "dna.fasta",
    kind: "sequence",
  },
  "protein-fasta": {
    label: "Protein FASTA",
    tag: "FAA",
    description: "Amino-acid sequences",
    accept: fastaAcceptTypes.protein,
    contentType: `${fastaContentType}; charset=utf-8`,
    extension: "protein.fasta",
    kind: "sequence",
  },
};

export const sequenceTypeOfFormat: Record<
  SequenceDownloadFormatId,
  FastaSequenceType
> = {
  "dna-fasta": "dna",
  "protein-fasta": "protein",
};

export function isSequenceDownloadFormat(
  format: DownloadFormatId,
): format is SequenceDownloadFormatId {
  return downloadFormats[format].kind === "sequence";
}

export interface SequenceDownload {
  formats: readonly SequenceDownloadFormatId[];
  via?: {
    resource: FastaResource;
    key: string;
    sort: string;
    note: string;
  };
  /**
   * Whole contigs: no row count bounds the size, so it always streams to disk.
   */
  unboundedSize?: boolean;
}

/**
 * Each source must be a resource `fastaResources` serves in that type; a test
 * keeps the tables in step.
 */
export const sequenceDownloads = {
  genome: {
    formats: ["dna-fasta"],
    via: {
      resource: "genome_sequence",
      key: "genome_id",
      sort: "sequence_id",
      note: "Contigs of each genome",
    },
    unboundedSize: true,
  },
  genome_feature: { formats: ["dna-fasta", "protein-fasta"] },
  genome_sequence: { formats: ["dna-fasta"], unboundedSize: true },
} as const satisfies Partial<Record<DataResource, SequenceDownload>>;

export function sequenceDownloadFor(
  resource: DataResource,
): SequenceDownload | undefined {
  return Object.hasOwn(sequenceDownloads, resource)
    ? (sequenceDownloads as Partial<Record<DataResource, SequenceDownload>>)[
        resource
      ]
    : undefined;
}

export function downloadFormatsFor(
  resource: DataResource,
): readonly DownloadFormatId[] {
  return [
    ...tableDownloadFormatIds,
    ...(sequenceDownloadFor(resource)?.formats ?? []),
  ];
}

export const maxSelectionDownloadRows = 10_000;
export const maxBufferedDownloadRows = 10_000;
export const maxQueryDownloadRows = 2_500_000;
export const maxExcelRows = 1_048_575;
export const maxSequenceQueryRows = 10_000;
/** 10,000 feature IDs run to about 450 KB, so this route has its own cap. */
export const maxDownloadRequestBytes = 1_000_000;

export interface DownloadQuery {
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
}

export type DownloadScope =
  | { kind: "selected"; ids: string[] }
  | ({ kind: "query" } & DownloadQuery);

export interface DownloadRequest {
  format: DownloadFormatId;
  scope: DownloadScope;
  sort?: DataSort;
  fields?: string[];
  fileNameBase: string;
  /**
   * Checked against the caps; a query's rows are recounted before the read and
   * never limited to this.
   */
  total: number;
  /**
   * Echoed in the `dxkb-download` cookie so the native transport knows when the
   * browser took the file.
   */
  nonce?: string;
}

export function downloadRowCount(request: {
  scope: DownloadScope;
  total: number;
}): number {
  return request.scope.kind === "selected"
    ? request.scope.ids.length
    : request.total;
}

/**
 * The data service reads a name starting with a digit (`1_pb2`) as a number, so
 * it cannot select it; JSON reads project locally, table files leave the column
 * empty.
 */
export function unselectableFields(fields: readonly string[]): string[] {
  return fields.filter((field) => /^\d/.test(field));
}

export function unselectableColumnsReason(
  fields: readonly string[],
): string | null {
  if (fields.length === 0) return "No columns are visible";
  const unselectable = unselectableFields(fields);
  if (unselectable.length === 0) return null;
  const named =
    unselectable.length > 2
      ? `${unselectable.slice(0, 2).join(", ")} and ${String(unselectable.length - 2)} more`
      : unselectable.join(" and ");
  return `The data service cannot select ${named}`;
}

export function usesNativeDownload(
  resource: DataResource,
  request: DownloadRequest,
): boolean {
  if (
    isSequenceDownloadFormat(request.format) &&
    sequenceDownloadFor(resource)?.unboundedSize
  )
    return true;
  return (
    request.scope.kind === "query" && request.total > maxBufferedDownloadRows
  );
}

export interface CollectionDownloadSpec {
  tableFormats?: readonly TableDownloadFormatId[];
  sequenceFormats?: readonly SequenceDownloadFormatId[];
  enabled?: boolean;
}

export interface ResolvedCollectionDownloadSpec {
  tableFormats: readonly TableDownloadFormatId[];
  sequenceFormats: readonly SequenceDownloadFormatId[];
  enabled: boolean;
  sequenceNote?: string;
}

export function resolveCollectionDownloadSpec(
  resource: DataResource,
  spec: CollectionDownloadSpec = {},
): ResolvedCollectionDownloadSpec {
  const sequence = sequenceDownloadFor(resource);
  const served: readonly SequenceDownloadFormatId[] = sequence?.formats ?? [];
  return {
    tableFormats: spec.tableFormats ?? tableDownloadFormatIds,
    sequenceFormats: (spec.sequenceFormats ?? served).filter((format) =>
      served.includes(format),
    ),
    enabled: spec.enabled ?? true,
    sequenceNote: sequence?.via?.note,
  };
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * The tile and the gateway share this reason so they cannot disagree about a
 * limit.
 */
export function downloadUnavailableReason({
  format,
  scope,
  rows,
}: {
  format: DownloadFormatId;
  scope: "selected" | "all";
  rows: number;
}): string | null {
  if (rows === 0)
    return scope === "selected" ? "Select rows first" : "No matching rows";
  if (scope === "selected" && rows > maxSelectionDownloadRows)
    return `Selections: ${count(maxSelectionDownloadRows)} rows at most`;
  if (scope === "all" && rows > maxQueryDownloadRows)
    return `Over ${count(maxQueryDownloadRows)} rows: narrow the filters`;
  if (format === "xlsx" && rows > maxExcelRows)
    return `Over Excel's ${count(maxExcelRows + 1)}-row limit`;
  if (
    isSequenceDownloadFormat(format) &&
    scope === "all" &&
    rows > maxSequenceQueryRows
  )
    return `Sequences: ${count(maxSequenceQueryRows)} rows at most`;
  return null;
}

export function queryDownloadRowLimit(format: DownloadFormatId): number {
  if (isSequenceDownloadFormat(format)) return maxSequenceQueryRows;
  return format === "xlsx" ? maxExcelRows : maxQueryDownloadRows;
}

export function downloadFileNameBase(
  base: string,
  scope: "selected" | "all",
): string {
  return scope === "selected" ? `${base}-selected` : base;
}

export function downloadFileName(
  fileNameBase: string,
  format: DownloadFormatId,
): string {
  return `${safeFileNameBase(fileNameBase) || "download"}.${downloadFormats[format].extension}`;
}

export function emptyDownloadMessage(format: DownloadFormatId): string {
  return isSequenceDownloadFormat(format)
    ? `No ${sequenceTypeOfFormat[format] === "dna" ? "DNA" : "protein"} sequence is available for the requested records.`
    : "No records matched the download.";
}

export const downloadNonceCookie = "dxkb-download";
export const downloadNoncePattern = /^[A-Za-z0-9_-]{8,64}$/;

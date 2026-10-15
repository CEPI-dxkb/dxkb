import {
  fastaAcceptTypes,
  fastaContentType,
  type FastaResource,
  type FastaSequenceType,
} from "./fasta";
import { safeFileNameBase } from "./file-name";
import type { DataResource, DataSort } from "./types";

/**
 * The table download contract every layer shares: which formats a resource
 * offers, where its sequences come from, the row limits, and how the file is
 * named. Browser-safe and dependency-free, like `./fasta.ts`, so the action-bar
 * tile, `useCollectionDownload()`, the gateway route at
 * `/api/data/[resource]/download` and `ServerDataRepository.download()` all
 * read the same tables.
 *
 * Every resource offers the table formats. A resource gains sequence formats
 * with one entry in {@link sequenceDownloads}; a view narrows its own set with
 * a `download` spec on its collection profile (the Proteins lists offer
 * Protein FASTA only).
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
  /** The short extension tag drawn beside the format's name. */
  tag: string;
  description: string;
  /** The upstream Data API's `Accept` value for this format. */
  accept: string;
  /** What the gateway answers with, and the type the saved file gets. */
  contentType: string;
  extension: string;
  kind: "table" | "sequence";
}

/**
 * The upstream answers Text as `text/plain`, Excel as a buffered
 * `application/vnd.openxmlformats` body, and FASTA as
 * `application/octet-stream`; the gateway relabels each with the type the
 * saved file should carry.
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
  /**
   * Where the sequences come from when they are not the resource's own
   * records: `resource` is read with `in(<key>,(<this resource's ids>))`,
   * sorted by `sort`. `note` tells the user what the file holds.
   */
  via?: {
    resource: FastaResource;
    key: string;
    sort: string;
    note: string;
  };
  /**
   * The file holds whole contigs, whose size no row count bounds (one
   * genome's run to megabytes, and a selection may name 10,000 genomes), so
   * it always streams to disk (`usesNativeDownload`).
   */
  unboundedSize?: boolean;
}

/**
 * Sequence formats per resource, from legacy BV-BRC's DWNLD dialog. A Genome
 * row has no sequence of its own, so its DNA FASTA is every contig of each
 * genome. Each source must be one `fastaResources` serves in that type; a
 * test keeps the two tables in step.
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

/** Every format `resource` can be downloaded in, tables first. */
export function downloadFormatsFor(
  resource: DataResource,
): readonly DownloadFormatId[] {
  return [
    ...tableDownloadFormatIds,
    ...(sequenceDownloadFor(resource)?.formats ?? []),
  ];
}

/**
 * A selection of up to this many rows goes out as one `in(<pk>,(…))`. Legacy
 * DWNLD's `max`; the upstream accepted a 10,001-value list in one POST body.
 */
export const maxSelectionDownloadRows = 10_000;
/**
 * At or under this many rows the browser fetches the file and saves it; above
 * it a native form POST streams it straight to disk.
 */
export const maxBufferedDownloadRows = 10_000;
/** Legacy's selection `limit()`. Above it the user narrows the filters. */
export const maxQueryDownloadRows = 2_500_000;
/** Excel's sheet limit, less the header row. */
export const maxExcelRows = 1_048_575;
/** The most matching rows an all-results FASTA download sends. */
export const maxSequenceQueryRows = 10_000;
/**
 * The largest body `POST /api/data/[resource]/download` admits. 10,000
 * feature IDs run to about 450 KB, so this route gets its own cap; the other
 * Data API routes keep `maxRequestBytes`.
 */
export const maxDownloadRequestBytes = 1_000_000;

export interface DownloadQuery {
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
}

/** The rows a download covers: explicit ids, or every row a query matches. */
export type DownloadScope =
  | { kind: "selected"; ids: string[] }
  | ({ kind: "query" } & DownloadQuery);

export interface DownloadRequest {
  format: DownloadFormatId;
  scope: DownloadScope;
  sort?: DataSort;
  /** Table formats only. Omitted means every stored field (no `select()`). */
  fields?: string[];
  /** The file name without its extension (`downloadFileNameBase`). */
  fileNameBase: string;
  /**
   * The matching-row count the client saw, which the caps are checked on. A
   * query's rows are counted again before the read and never limited to this.
   */
  total: number;
  /**
   * Echoed back in the `dxkb-download` cookie, so the native transport can
   * tell when the browser has taken the file.
   */
  nonce?: string;
}

/** The rows a request covers: its ids, or the query's matching count. */
export function downloadRowCount(request: {
  scope: DownloadScope;
  total: number;
}): number {
  return request.scope.kind === "selected"
    ? request.scope.ids.length
    : request.total;
}

/**
 * The fields the data service cannot `select()`: it reads a name that starts
 * with a digit (a Strain's `1_pb2`) as a number, in RQL and in Solr's own
 * field list alike. A JSON read projects those rows locally instead; a table
 * file is the upstream's stream, and its formats leave such a column empty.
 */
export function unselectableFields(fields: readonly string[]): string[] {
  return fields.filter((field) => /^\d/.test(field));
}

/**
 * Why a table file cannot hold only `fields`, or `null` when it can: no
 * columns at all (every one hidden in the table), or one the data service
 * cannot select. The tile disables its *Visible columns* switch with this
 * reason and the gateway refuses such a request with it, so a file never
 * holds columns the switch left out.
 */
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

/**
 * Whether a request streams to disk through a form POST (`startNativeDownload`)
 * rather than being held in the tab as a `Blob`: a query of more than
 * `maxBufferedDownloadRows` rows, or a sequence file of whole contigs at any
 * row count (`SequenceDownload.unboundedSize`).
 */
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

/** How a view narrows its resource's formats. Most declare nothing. */
export interface CollectionDownloadSpec {
  /** Defaults to every table format. */
  tableFormats?: readonly TableDownloadFormatId[];
  /** Defaults to the resource's `sequenceDownloads` formats. */
  sequenceFormats?: readonly SequenceDownloadFormatId[];
  /** `false` hides the tile. */
  enabled?: boolean;
}

export interface ResolvedCollectionDownloadSpec {
  tableFormats: readonly TableDownloadFormatId[];
  sequenceFormats: readonly SequenceDownloadFormatId[];
  enabled: boolean;
  /** What the sequence files hold, when not the rows' own records. */
  sequenceNote?: string;
}

/**
 * A view's spec with the resource defaults filled in. Sequence formats the
 * resource does not serve are dropped, so a spec cannot offer a file the
 * gateway would refuse.
 */
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
 * Why a format cannot be downloaded for this many rows, or `null` when it can.
 * The tile shows the reason on the disabled row, and the gateway answers it
 * as a 400, so the two cannot disagree about a limit.
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

/**
 * The most rows an all-results download in `format` sends: the sequence cap,
 * Excel's sheet, else legacy's `limit()` — the lowest cap
 * `downloadUnavailableReason` applies to it. The gateway asks the upstream for
 * this many after counting the query again, so a file is never cut at the
 * count the table loaded earlier.
 */
export function queryDownloadRowLimit(format: DownloadFormatId): number {
  if (isSequenceDownloadFormat(format)) return maxSequenceQueryRows;
  return format === "xlsx" ? maxExcelRows : maxQueryDownloadRows;
}

/**
 * The file name without its extension: `<base>` for all results and
 * `<base>-selected` for a selection. `<base>` is the profile's
 * `exportFileName`, else the resource name.
 */
export function downloadFileNameBase(
  base: string,
  scope: "selected" | "all",
): string {
  return scope === "selected" ? `${base}-selected` : base;
}

/** `<fileNameBase>.<extension>`, with the base made safe on every desktop OS. */
export function downloadFileName(
  fileNameBase: string,
  format: DownloadFormatId,
): string {
  return `${safeFileNameBase(fileNameBase) || "download"}.${downloadFormats[format].extension}`;
}

/** What an empty file means, for the error a click reports instead of saving it. */
export function emptyDownloadMessage(format: DownloadFormatId): string {
  return isSequenceDownloadFormat(format)
    ? `No ${sequenceTypeOfFormat[format] === "dna" ? "DNA" : "protein"} sequence is available for the requested records.`
    : "No records matched the download.";
}

/** The cookie the gateway sets, carrying the request's nonce, when a file starts. */
export const downloadNonceCookie = "dxkb-download";
export const downloadNoncePattern = /^[A-Za-z0-9_-]{8,64}$/;

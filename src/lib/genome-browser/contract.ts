/**
 * The Genome Browser's shared contract: legacy track ids, the two annotation
 * tracks, chunk sizes and request bounds, the JSON the
 * `/api/genome-browser/[operation]` route answers with, and where the browser
 * opens.
 *
 * Imported by the route, the browser client, the tab builders and the JBrowse
 * plugin, so it imports nothing: no Data API registry, no Zod, no JBrowse.
 *
 * Coordinates: wire shapes and the `start`/`end` query params are 0-based and
 * half-open, JBrowse's convention. The Data API's `start`/`end` are 1-based and
 * inclusive; only `server.ts` converts. Location strings (`ref:1..100`) are
 * 1-based and inclusive, as JBrowse and legacy BV-BRC write them.
 */

export const genomeBrowserAnnotations = ["PATRIC", "RefSeq"] as const;
export type GenomeBrowserAnnotation = (typeof genomeBrowserAnnotations)[number];

export function isGenomeBrowserAnnotation(
  value: string,
): value is GenomeBrowserAnnotation {
  return (genomeBrowserAnnotations as readonly string[]).includes(value);
}

/**
 * Legacy BV-BRC's JBrowse 1 track labels, kept as track ids so a legacy
 * `tracks=refseqs,PATRICGenes,RefSeqGenes` link names the same tracks.
 */
export const genomeBrowserTrackIds = [
  "refseqs",
  "PATRICGenes",
  "RefSeqGenes",
] as const;
export type GenomeBrowserTrackId = (typeof genomeBrowserTrackIds)[number];

export function isGenomeBrowserTrackId(
  value: string,
): value is GenomeBrowserTrackId {
  return (genomeBrowserTrackIds as readonly string[]).includes(value);
}

export const sequenceTrackId: GenomeBrowserTrackId = "refseqs";

export const annotationTrackIds: Record<
  GenomeBrowserAnnotation,
  GenomeBrowserTrackId
> = { PATRIC: "PATRICGenes", RefSeq: "RefSeqGenes" };

/** Legacy `chunkSize` of the PATRICGenes and RefSeqGenes tracks. */
export const featureChunkSize = 100_000;
/** Legacy `chunkSize` of the refseqs track. */
export const sequenceChunkSize = 20_000;
/** Widest feature request the route accepts: ten feature chunks. */
export const maxFeatureSpan = 1_000_000;
/** Widest sequence request the route accepts: five sequence chunks. */
export const maxSequenceSpan = 100_000;
/** Rows one feature request returns before it reports `truncated`. */
export const maxFeatureRows = 10_000;
/** Sequences a genome may have and still open in the browser. */
export const maxRegions = 25_000;
/** How much of the first sequence the Genome View opens on. */
export const defaultGenomeWindow = 100_000;
/** Legacy Feature View flank: `start - 3000 .. end + 3000`. */
export const featureFlank = 3_000;

/** One reference sequence, as JBrowse's `getRegions` returns it. */
export interface GenomeBrowserRegion {
  refName: string;
  start: number;
  end: number;
}

export interface GenomeBrowserRegionsResult {
  regions: GenomeBrowserRegion[];
}

export interface GenomeBrowserSubfeature {
  refName: string;
  start: number;
  end: number;
  strand: -1 | 0 | 1;
  type: string;
}

/**
 * One feature, already in JBrowse's serialized `SimpleFeature` shape. The
 * snake_case attributes are the Data API's field names, shown as-is in the
 * feature details dialog.
 */
export interface GenomeBrowserFeature {
  uniqueId: string;
  refName: string;
  start: number;
  end: number;
  strand: -1 | 0 | 1;
  type: string;
  name: string;
  feature_id: string;
  patric_id?: string;
  refseq_locus_tag?: string;
  alt_locus_tag?: string;
  gene?: string;
  product?: string;
  protein_id?: string;
  na_length?: number;
  aa_length?: number;
  subfeatures?: GenomeBrowserSubfeature[];
}

export interface GenomeBrowserFeaturesResult {
  features: GenomeBrowserFeature[];
  /** More than `maxFeatureRows` features overlap the request. */
  truncated: boolean;
}

/** `seq` covers `[start, end)`; `end` stops at the end of the sequence. */
export interface GenomeBrowserSequenceResult {
  start: number;
  end: number;
  seq: string;
}

/** Where the Feature View opens the browser, and what it highlights. */
export interface GenomeBrowserFocus {
  location: string;
  highlight: string;
}

export function formatLocation(
  refName: string,
  start: number,
  end: number,
): string {
  return `${refName}:${String(start)}..${String(end)}`;
}

/** The sequence a location string names: everything before its last `:`. */
export function locationRefName(location: string): string {
  const colon = location.lastIndexOf(":");
  return colon > 0 ? location.slice(0, colon) : location;
}

/** The first `defaultGenomeWindow` bases of the first (longest) sequence. */
export function genomeDefaultLocation(
  regions: readonly GenomeBrowserRegion[],
): string | undefined {
  const first = regions.at(0);
  if (!first) return undefined;
  return formatLocation(
    first.refName,
    first.start + 1,
    Math.min(first.end, first.start + defaultGenomeWindow),
  );
}

/**
 * An integer as the Data API sends one (a number or a numeric string), or
 * `undefined` for anything else. Shared by `featureBrowserFocus` and
 * `server.ts`'s row mapping.
 */
export function asInteger(value: unknown): number | undefined {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number)
    ? number
    : undefined;
}

/**
 * Legacy Feature View framing: the feature with 3 kb either side, the left
 * flank clamped at base 1 (JBrowse clamps the right one to the sequence), and
 * the feature itself highlighted.
 */
export function featureBrowserFocus(feature: {
  accession?: string;
  start?: string | number;
  end?: string | number;
}): GenomeBrowserFocus | null {
  const start = asInteger(feature.start);
  const end = asInteger(feature.end);
  if (!feature.accession || start === undefined || end === undefined) {
    return null;
  }
  if (start < 1 || end < start) return null;
  return {
    location: formatLocation(
      feature.accession,
      Math.max(1, start - featureFlank),
      end + featureFlank,
    ),
    highlight: formatLocation(feature.accession, start, end),
  };
}

/**
 * What follows a sequence name in a location JBrowse reads: `:<start>..<end>`
 * or `:<start>-<end>`, in digits that may be grouped with commas.
 */
const locationCoordinates = /^:(\d[\d,]*)(?:\.\.|-)(\d[\d,]*)$/;

/**
 * Well-formed coordinates in order: JBrowse throws "found start greater than
 * end" for a reversed range and leaves a blank view. Compared as numbers once
 * the digit grouping is gone.
 */
function readableCoordinates(coordinates: string): boolean {
  const match = locationCoordinates.exec(coordinates);
  if (!match) return false;
  const number = (digits = "") => Number(digits.replace(/,/g, ""));
  return number(match[1]) <= number(match[2]);
}

/**
 * The URL's location when it names one of this genome's sequences, either bare
 * or with well-formed coordinates in order, otherwise the fallback. JBrowse throws for
 * an unknown sequence and for coordinates it cannot parse, and a hand-edited or
 * cross-genome link should still open the browser. Also the check for
 * `browser.highlight`, which names a place the same way.
 */
export function resolveInitialLocation(
  requested: string | undefined,
  regions: readonly GenomeBrowserRegion[],
  fallback: string | undefined,
): string | undefined {
  if (requested) {
    const names = (refName: string) =>
      regions.some((region) => region.refName === refName);
    if (names(requested)) return requested;
    const refName = locationRefName(requested);
    if (
      names(refName) &&
      readableCoordinates(requested.slice(refName.length))
    ) {
      return requested;
    }
  }
  return fallback;
}

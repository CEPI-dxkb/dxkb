/**
 * Shared Genome Browser contract; imports nothing so the route, client, tab builders and JBrowse plugin can all use it.
 * Wire shapes and `start`/`end` query params are 0-based half-open (JBrowse); the Data API is 1-based inclusive and only `server.ts` converts. Location strings (`ref:1..100`) are 1-based inclusive.
 */

export const genomeBrowserAnnotations = ["PATRIC", "RefSeq"] as const;
export type GenomeBrowserAnnotation = (typeof genomeBrowserAnnotations)[number];

export function isGenomeBrowserAnnotation(
  value: string,
): value is GenomeBrowserAnnotation {
  return (genomeBrowserAnnotations as readonly string[]).includes(value);
}

/** Legacy JBrowse 1 track labels, so a legacy `tracks=refseqs,PATRICGenes,RefSeqGenes` link names the same tracks. */
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

export const featureChunkSize = 100_000;
export const sequenceChunkSize = 20_000;
export const maxFeatureSpan = 1_000_000;
export const maxSequenceSpan = 100_000;
export const maxFeatureRows = 10_000;
export const maxRegions = 25_000;
export const defaultGenomeWindow = 100_000;
export const featureFlank = 3_000;

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

/** The snake_case attributes are the Data API's field names, shown as-is in the feature details dialog. */
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
  truncated: boolean;
}

export interface GenomeBrowserSequenceResult {
  start: number;
  end: number;
  seq: string;
}

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

export function locationRefName(location: string): string {
  const colon = location.lastIndexOf(":");
  return colon > 0 ? location.slice(0, colon) : location;
}

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

export function asInteger(value: unknown): number | undefined {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number)
    ? number
    : undefined;
}

/** Legacy Feature View framing: 3 kb either side, the left flank clamped at base 1. */
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

const locationCoordinates = /^:(\d[\d,]*)(?:\.\.|-)(\d[\d,]*)$/;

/** JBrowse throws "found start greater than end" for a reversed range and leaves a blank view. */
function readableCoordinates(coordinates: string): boolean {
  const match = locationCoordinates.exec(coordinates);
  if (!match) return false;
  const number = (digits = "") => Number(digits.replace(/,/g, ""));
  return number(match[1]) <= number(match[2]);
}

/** The URL's location when it names one of this genome's sequences with well-formed coordinates, else the fallback: JBrowse throws for an unknown sequence or unparseable coordinates. */
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

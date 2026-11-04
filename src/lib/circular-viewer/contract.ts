/**
 * The Circular Viewer's contract with `/api/circular-viewer/[operation]`,
 * shared by `./server.ts` and `./client.ts` and free of server imports, so
 * the browser bundle can read it. Feature coordinates are the Data API's:
 * 1-based and inclusive. Bounds are legacy BV-BRC's
 * (`CircularViewerContainer.js`) unless a comment says otherwise.
 */

export const circularViewerOperations = [
  "contigs",
  "track",
  "custom",
  "gc",
] as const;
export type CircularViewerOperation = (typeof circularViewerOperations)[number];

export function isCircularViewerOperation(
  value: string,
): value is CircularViewerOperation {
  return (circularViewerOperations as readonly string[]).includes(value);
}

/** Legacy read the first 1,000 sequences by accession (`limit(1000)`). */
export const maxContigs = 1_000;
/** Legacy read at most 25,000 features per track (`limit(25000)`). */
export const maxTrackFeatures = 25_000;
/**
 * The GC tracks read a genome's sequences whole on the server. The largest
 * bacterial genomes are ~16 Mb; this is a memory bound, not a legacy one.
 */
export const maxGcGenomeLength = 30_000_000;
export const maxKeywordLength = 200;

export const featurePresetIds = [
  "cds-forward",
  "cds-reverse",
  "non-cds",
] as const;
export const specialtyPresetIds = [
  "amr",
  "vf",
  "transporter",
  "drug-target",
] as const;
export type FeaturePresetId = (typeof featurePresetIds)[number];
export type SpecialtyPresetId = (typeof specialtyPresetIds)[number];
export type PresetTrackId = FeaturePresetId | SpecialtyPresetId;
export const presetTrackIds: readonly PresetTrackId[] = [
  ...featurePresetIds,
  ...specialtyPresetIds,
];

export function isPresetTrackId(value: string): value is PresetTrackId {
  return (presetTrackIds as readonly string[]).includes(value);
}

export function isSpecialtyPresetId(
  value: PresetTrackId,
): value is SpecialtyPresetId {
  return (specialtyPresetIds as readonly string[]).includes(value);
}

/** Legacy `TrackController`'s Type select (`Miscellaneous` was labelled "Misc"). */
export const customFeatureTypes = ["CDS", "RNA", "Miscellaneous"] as const;
export type CustomFeatureType = (typeof customFeatureTypes)[number];

export function isCustomFeatureType(
  value: unknown,
): value is CustomFeatureType {
  return (customFeatureTypes as readonly unknown[]).includes(value);
}

/**
 * Legacy's Strand select sent `+`/`-`; the wire uses words, since a bare `+`
 * in a query string reads as a space.
 */
export const customStrands = ["both", "forward", "reverse"] as const;
export type CustomStrand = (typeof customStrands)[number];

export function isCustomStrand(value: unknown): value is CustomStrand {
  return (customStrands as readonly unknown[]).includes(value);
}

export interface CustomTrackQuery {
  type: CustomFeatureType;
  strand: CustomStrand;
  keyword: string;
}

export interface CircularContig {
  accession: string;
  sequenceId: string;
  length: number;
  gcContent?: number;
  topology?: string;
  sequenceType?: string;
}

export interface CircularContigsResult {
  contigs: CircularContig[];
  /** More than `maxContigs` sequences: only the first are drawn. */
  truncated: boolean;
}

export interface CircularFeature {
  featureId: string;
  accession: string;
  start: number;
  end: number;
  strand: "+" | "-" | null;
  featureType: string;
  patricId?: string;
  product?: string;
  gene?: string;
  refseqLocusTag?: string;
  proteinId?: string;
  naLength?: number;
  aaLength?: number;
}

export interface CircularTrackResult {
  features: CircularFeature[];
  /** More than `maxTrackFeatures` matched: only the first are drawn. */
  truncated: boolean;
}

/** One sequence's windows: window `i` covers `[i * windowSize, min(length, (i + 1) * windowSize))`. */
export interface GcContig {
  accession: string;
  length: number;
  gc: number[];
  skew: number[];
}

export interface GcResult {
  windowSize: number;
  contigs: GcContig[];
}

/** Legacy: 2,000 nt windows; 50 nt up to 100 kb; 20 nt up to 10 kb. */
export function gcWindowSize(genomeLength: number): number {
  if (genomeLength <= 10_000) return 20;
  if (genomeLength <= 100_000) return 50;
  return 2_000;
}

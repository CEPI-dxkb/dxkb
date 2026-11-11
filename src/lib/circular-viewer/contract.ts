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

export const maxContigs = 1_000;
export const maxTrackFeatures = 25_000;
/** A memory bound: the GC tracks read a genome's sequences whole on the server. */
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

export const customFeatureTypes = ["CDS", "RNA", "Miscellaneous"] as const;
export type CustomFeatureType = (typeof customFeatureTypes)[number];

export function isCustomFeatureType(
  value: unknown,
): value is CustomFeatureType {
  return (customFeatureTypes as readonly unknown[]).includes(value);
}

/** The wire uses words, since a bare `+` in a query string reads as a space. */
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
  truncated: boolean;
}

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

export function gcWindowSize(genomeLength: number): number {
  if (genomeLength <= 10_000) return 20;
  if (genomeLength <= 100_000) return 50;
  return 2_000;
}

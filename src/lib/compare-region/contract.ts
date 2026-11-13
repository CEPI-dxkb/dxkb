export const compareRegionSizes = [
  5000, 10000, 15000, 20000, 50000, 75000, 100000,
] as const;
export const compareRegionGenomeCounts = [5, 10, 15, 20, 50] as const;
export const compareRegionMethods = ["pgfam", "plfam"] as const;
/**
 * `server.ts` maps `reference` to `representative+reference`, whose `+` would
 * read as a space in a query.
 */
export const compareRegionFilters = [
  "reference",
  "all",
  "genomeGroup",
  "featureGroup",
] as const;

export type CompareRegionSize = (typeof compareRegionSizes)[number];
export type CompareRegionGenomeCount = (typeof compareRegionGenomeCounts)[number];
export type CompareRegionMethod = (typeof compareRegionMethods)[number];
export type CompareRegionFilter = (typeof compareRegionFilters)[number];
export type CompareRegionGroupFilter = "genomeGroup" | "featureGroup";

export function isCompareRegionGroupFilter(
  filter: CompareRegionFilter,
): filter is CompareRegionGroupFilter {
  return filter === "genomeGroup" || filter === "featureGroup";
}

export const maxCompareRegionGroupLength = 1024;

export function isCompareRegionGroupPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    value.length <= maxCompareRegionGroupLength &&
    !/\p{Cc}/u.test(value)
  );
}

export interface CompareRegionSettings {
  size: CompareRegionSize;
  genomes: CompareRegionGenomeCount;
  method: CompareRegionMethod;
  filter: CompareRegionFilter;
  group: string | null;
}

export const defaultCompareRegionSettings: CompareRegionSettings = {
  size: 10000,
  genomes: 10,
  method: "pgfam",
  filter: "reference",
  group: null,
};

export const compareRegionMethodLabels: Record<CompareRegionMethod, string> = {
  pgfam: "Cross-genus families (PGfams)",
  plfam: "Genus-specific families (PLfams)",
};

export const compareRegionMethodShortLabels: Record<CompareRegionMethod, string> = {
  pgfam: "PGfam",
  plfam: "PLfam",
};

export const compareRegionFilterLabels: Record<CompareRegionFilter, string> = {
  reference: "Reference & representative",
  // Signed in, the service may also compare the caller's private genomes, so
  // "public" would be wrong.
  all: "All genomes",
  genomeGroup: "Selected genome group",
  featureGroup: "Selected feature group",
};

export const compareRegionGroupLabels: Record<CompareRegionGroupFilter, string> = {
  genomeGroup: "Genome group",
  featureGroup: "Feature group",
};

export interface CompareRegionQuery extends CompareRegionSettings {
  peg: string;
}

export interface CompareRegionFeature {
  fid: string;
  type: string;
  /** `start` is the 5′ end, so `start > end` on the minus strand. */
  start: number;
  end: number;
  strand: "+" | "-" | null;
  product: string;
  family: number | null;
  familyId: string | null;
  identity: number | null;
}

export interface CompareRegionRow {
  genomeId: string;
  genomeName: string;
  start: number;
  end: number;
  contigLength: number | null;
  pinnedFid: string;
  pinnedStrand: "+" | "-";
  center: number;
  features: CompareRegionFeature[];
}

export interface CompareRegionResult {
  rows: CompareRegionRow[];
}

export function pickOption<T extends string | number>(
  values: readonly T[],
  raw: string | null,
  fallback: T,
): T | null {
  if (raw === null || raw === "") return fallback;
  return values.find((value) => String(value) === raw) ?? null;
}

export function parseCompareRegionSettings(
  read: (name: keyof CompareRegionSettings) => string | null,
): CompareRegionSettings | null {
  const defaults = defaultCompareRegionSettings;
  const size = pickOption(compareRegionSizes, read("size"), defaults.size);
  const genomes = pickOption(
    compareRegionGenomeCounts,
    read("genomes"),
    defaults.genomes,
  );
  const method = pickOption(compareRegionMethods, read("method"), defaults.method);
  const filter = pickOption(compareRegionFilters, read("filter"), defaults.filter);
  if (size === null || genomes === null || method === null || filter === null) {
    return null;
  }
  const group = read("group");
  if (isCompareRegionGroupFilter(filter)) {
    if (group === null || !isCompareRegionGroupPath(group)) return null;
    return { size, genomes, method, filter, group };
  }
  if (group !== null && group !== "") return null;
  return { size, genomes, method, filter, group: null };
}

/**
 * A PATRIC gene the service names: `fig|<genome>.<type>.<n>` (`peg` for a
 * bacterial CDS, `CDS` for a viral one, `rna`, `pg`, `repeat`, …), each a
 * `genome_feature` record with a `patric_id`. Neither the genome part nor the
 * type is constrained: BV-BRC has genome ids that are not `<digits>.<digits>`
 * (`fig|Dm_GEO12.peg.245`), and the feature page opens any `fig|` id. A BLAST
 * hit, `fig|<genome>.<type>.<n>.BLAST`, ends in a non-number and is not one.
 */
export function isCompareRegionLinkable(fid: string): boolean {
  return /^fig\|.+\.[^.]+\.\d+$/.test(fid);
}

/** Every linkable gene has the tab: the feature page accepts any `fig|` BRC ID. */
export function hasCompareRegionTab(fid: string): boolean {
  return isCompareRegionLinkable(fid);
}

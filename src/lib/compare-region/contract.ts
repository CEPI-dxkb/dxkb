/**
 * The Compare Region Viewer's contract, shared by the route (`server.ts`) and
 * the browser (`client.ts`, `url-state.ts`, the panel): the settings a request
 * takes and the rows `/api/compare-region` answers. It imports nothing, so it
 * costs a client bundle nothing.
 *
 * The option lists are legacy BV-BRC's (`CompareRegionContainer.js`).
 */

export const compareRegionSizes = [
  5000, 10000, 15000, 20000, 50000, 75000, 100000,
] as const;
export const compareRegionGenomeCounts = [5, 10, 15, 20, 50] as const;
export const compareRegionMethods = ["pgfam", "plfam"] as const;
/**
 * URL and route tokens. `server.ts` maps `reference` to the service's
 * `representative+reference`, whose `+` would read as a space in a query.
 */
export const compareRegionFilters = ["reference", "all"] as const;

export type CompareRegionSize = (typeof compareRegionSizes)[number];
export type CompareRegionGenomeCount = (typeof compareRegionGenomeCounts)[number];
export type CompareRegionMethod = (typeof compareRegionMethods)[number];
export type CompareRegionFilter = (typeof compareRegionFilters)[number];

export interface CompareRegionSettings {
  /** Width of the window around the focus gene, bp. */
  size: CompareRegionSize;
  /** How many other genomes to compare. */
  genomes: CompareRegionGenomeCount;
  /** Which protein families decide homology (and so color). */
  method: CompareRegionMethod;
  /** Which genomes are candidates. */
  filter: CompareRegionFilter;
}

export const defaultCompareRegionSettings: CompareRegionSettings = {
  size: 10000,
  genomes: 10,
  method: "pgfam",
  filter: "reference",
};

export const compareRegionMethodLabels: Record<CompareRegionMethod, string> = {
  pgfam: "Cross-genus families (PGfams)",
  plfam: "Genus-specific families (PLfams)",
};

export const compareRegionFilterLabels: Record<CompareRegionFilter, string> = {
  reference: "Reference & representative",
  all: "All genomes",
};

export interface CompareRegionQuery extends CompareRegionSettings {
  /** The focus gene's BRC ID (`patric_id`, `fig|…`). */
  peg: string;
}

export interface CompareRegionFeature {
  fid: string;
  /** "peg", "blast", "pseudogene", "tRNA", "repeat_region", … */
  type: string;
  /**
   * Contig coordinates, 1-based. `start` is the 5′ end, so `start > end` on
   * the minus strand.
   */
  start: number;
  end: number;
  strand: "+" | "-" | null;
  /** The annotated function; "" when the service has none. */
  product: string;
  /** Homology set (`set_number`): equal numbers share a color across rows. */
  family: number | null;
  /** The PGfam or PLfam id behind `family`, for the tooltip. */
  familyId: string | null;
  /** BLAST identity to the focus gene, 0–100 (the pinned gene and `blast` hits only). */
  identity: number | null;
}

export interface CompareRegionRow {
  genomeId: string;
  genomeName: string;
  /** The window, in contig coordinates. May run past either end of the contig. */
  start: number;
  end: number;
  contigLength: number | null;
  /** The gene this row is aligned on (the focus gene itself in row 0). */
  pinnedFid: string;
  pinnedStrand: "+" | "-";
  /** The contig position every row is aligned at (`reference_point`). */
  center: number;
  features: CompareRegionFeature[];
}

/** `/api/compare-region`'s answer: the focus gene's row first; `[]` for an unknown gene. */
export interface CompareRegionResult {
  rows: CompareRegionRow[];
}

/**
 * `raw` as one of `values`: `fallback` when it is absent or empty, null when
 * it is not one of them.
 */
export function pickOption<T extends string | number>(
  values: readonly T[],
  raw: string | null,
  fallback: T,
): T | null {
  if (raw === null || raw === "") return fallback;
  return values.find((value) => String(value) === raw) ?? null;
}

/**
 * Settings read through `read` (a missing one takes its default), or null
 * when any value is not an offered option.
 */
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
  return { size, genomes, method, filter };
}

/**
 * Whether `fid` has a Feature View. The service also returns BLAST hits
 * (`….BLAST`), pseudogenes (`.pg.`) and repeats, gaps and the like, which are
 * not `genome_feature` records.
 */
export function isCompareRegionLinkable(fid: string): boolean {
  return /^fig\|.+\.(peg|rna)\.\d+$/.test(fid);
}

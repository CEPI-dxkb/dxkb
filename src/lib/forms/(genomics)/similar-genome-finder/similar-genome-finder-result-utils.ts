import { getFirstDefined } from "@/lib/utils";

/** Result row shape for Similar Genome Finder (when result data is available) */
export interface SimilarGenomeFinderResultRow {
  genome_id: string;
  genome_name: string;
  organism_name: string;
  genome_status?: string;
  genome_quality?: string;
  distance: number;
  pvalue: number;
  /** K-mer counts; may be number or string (e.g. "0/1000") from Minhash */
  counts?: number | string;
}

/** No result rows: one array, never mutated, so it is stable across renders. */
export const noSimilarGenomeResults: SimilarGenomeFinderResultRow[] = [];

/**
 * Convert columnar result { genome_id: [...], distance: [...] } to row array.
 */
function asUnknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? (value as unknown[]) : undefined;
}

function columnarToRows(result: Record<string, unknown>): unknown[] {
  const ids = result.genome_id ?? result.genomeId ?? result.id;
  const arr = Array.isArray(ids) ? (ids as unknown[]) : [];
  if (arr.length === 0) return [];
  const dist = asUnknownArray(result.distance) ?? asUnknownArray(result.dist);
  const pval = asUnknownArray(result.pvalue) ?? asUnknownArray(result.p_value);
  const cnt = asUnknownArray(result.counts) ?? asUnknownArray(result.kmer_count);
  const names = asUnknownArray(result.genome_name);
  const organisms = asUnknownArray(result.organism_name);
  return arr.map((id: unknown, i) => ({
    genome_id: id,
    genome_name: names?.[i],
    organism_name: organisms?.[i],
    distance: dist?.[i],
    pvalue: pval?.[i],
    counts: cnt?.[i],
  }));
}

/**
 * Extract the hits array from Minhash JSON-RPC response.
 * Handles: { result: [...] }, { result: [ [ row1, row2, ... ] ] } (nested), columnar, or top-level array.
 */
function extractMinhashArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const result = obj.result;
  if (Array.isArray(result)) {
    if (result.length === 1 && Array.isArray(result[0])) return result[0] as unknown[];
    return result;
  }
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.hits)) return r.hits;
    if (Array.isArray(r.results)) return r.results;
    if (Array.isArray(r[0])) return r[0] as unknown[];
    if (Array.isArray(r.genome_id ?? r.genomeId)) return columnarToRows(r);
    const values = Object.values(r);
    if (values.length > 0 && Array.isArray(values[0])) return values.flat();
  }
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.hits)) return obj.hits;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.genome_id ?? obj.genomeId)) return columnarToRows(obj);
  return [];
}

function parseNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseCounts(v: unknown): number | string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    if (v.includes("/")) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Minhash JSON-RPC returns { result: [...] }. Extract rows with genome_id and metrics. */
export function parseMinhashResultPayload(
  payload: unknown,
): SimilarGenomeFinderResultRow[] {
  const arr = extractMinhashArray(payload);
  return arr.map((item): SimilarGenomeFinderResultRow => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const arrRow = Array.isArray(item) ? item : [];
    const genomeId =
      getFirstDefined(row, "genome_id", "genomeId", "genome ID", "id", "ref", "reference") ??
      (arrRow[0] !== undefined ? String(arrRow[0]) : "");
    const distanceVal: unknown = getFirstDefined(row, "distance") ?? arrRow[1];
    const pvalueVal: unknown = getFirstDefined(row, "pvalue", "p_value") ?? arrRow[2];
    const countsVal: unknown = getFirstDefined(row, "counts", "kmer_count") ?? arrRow[3];
    return {
      genome_id: typeof genomeId === 'string' ? genomeId : (typeof genomeId === 'number' || typeof genomeId === 'boolean' ? String(genomeId) : ""),
      genome_name: String((getFirstDefined(row, "genome_name", "genomeName", "genome name") as string | number | undefined) ?? ""),
      organism_name: String(
        (getFirstDefined(row, "organism_name", "organismName", "organism name", "organism") as string | number | undefined) ?? "",
      ),
      distance: parseNum(distanceVal),
      pvalue: parseNum(pvalueVal),
      counts: parseCounts(countsVal),
    };
  });
}

/** Build table rows by merging Minhash metrics with BV-BRC genome API response. */
export function mergeGenomeResults(
  minhashRows: SimilarGenomeFinderResultRow[],
  genomeApiResults: Record<string, string>[],
): SimilarGenomeFinderResultRow[] {
  const byId = new Map<string, Record<string, string>>();
  for (const row of genomeApiResults) {
    const id = row.genome_id;
    if (id) byId.set(id.trim(), row);
  }

  function getFirstNonEmptyString(
    row: Record<string, string>,
    ...keys: string[]
  ): string {
    for (const k of keys) {
      const v = getFirstDefined(row, k) as string | undefined;
      if (v != null && v.trim() !== "") return v;
    }
    return "";
  }

  return minhashRows.map((m) => {
    const genome = m.genome_id ? byId.get(m.genome_id.trim()) : undefined;
    return {
      ...m,
      genome_name: genome
        ? getFirstNonEmptyString(genome, "genome_name", "genome name")
        : m.genome_name,
      organism_name: genome
        ? getFirstNonEmptyString(
            genome,
            "species",
            "organism_name",
            "organism name",
            "taxon_lineage_names",
            "genome_name",
          )
        : m.organism_name,
      genome_status: genome
        ? (getFirstNonEmptyString(genome, "genome_status") || undefined)
        : undefined,
      genome_quality: genome
        ? (getFirstNonEmptyString(genome, "genome_quality") || undefined)
        : undefined,
    };
  });
}

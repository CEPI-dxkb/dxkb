import { getRequiredEnv } from "@/lib/env";

export const numberFormatter = new Intl.NumberFormat("en-US");

export const organismBvBrcRevalidateSeconds = 86400;

// These calls sit on the server render path, so an upstream that never
// answers would hang the page instead of reaching its error surface. The
// budget only needs to stop true hangs: BV-BRC's own gateway answers 500 after
// ~20 s, and slow-but-good responses of 5–15 s occur. A timed-out response is
// never cached, so a budget below that range would keep a slow endpoint
// failing for every visitor instead of letting one slow success fill the cache.
export const organismFetchTimeoutMs = 30_000;

export function organismFetchCacheInit(
  revalidateSeconds: number,
): { cache: "no-store" } | { next: { revalidate: number } } {
  if (process.env.E2E_MOCK_ENABLED === "1") {
    return { cache: "no-store" };
  }
  return { next: { revalidate: revalidateSeconds } };
}

export function getBvBrcWebsiteApiBaseUrl(): string {
  return getRequiredEnv("BVBRC_WEBSITE_API_URL").replace(/\/+$/, "");
}

export async function responseErrorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return body.trim() || `${String(response.status)} ${response.statusText}`.trim();
}

// Matched by name rather than instanceof: the DOMException an abort produces
// can come from another realm (jsdom in tests), where instanceof Error fails.
function errorName(error: unknown): unknown {
  return typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
}

/**
 * Rethrows a failed organism request. A timeout is reworded to name the
 * endpoint and the budget (the platform message is only "The operation was
 * aborted due to timeout"); anything else is rethrown untouched.
 */
export function throwOrganismFetchError(error: unknown, source: string): never {
  if (errorName(error) === "TimeoutError") {
    throw new Error(
      `${source}: upstream did not respond within ${String(organismFetchTimeoutMs)}ms`,
    );
  }
  throw error;
}

/**
 * fetch() for BV-BRC organism endpoints. Applies the shared cache policy and
 * bounds the request with organismFetchTimeoutMs, composed with any caller
 * signal so caller cancellation keeps working.
 */
export async function fetchOrganism(
  url: string,
  source: string,
  init: RequestInit = {},
): Promise<Response> {
  const timeout = AbortSignal.timeout(organismFetchTimeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      ...organismFetchCacheInit(organismBvBrcRevalidateSeconds),
    });
  } catch (error) {
    throwOrganismFetchError(error, source);
  }
}

/**
 * Standard SOLR/BV-BRC fetch wrapper. Centralizes Accept header, cache init,
 * timeout, error message extraction, and JSON-object validation so callers
 * can stay focused on URL construction and payload parsing.
 */
export async function fetchOrganismSolrJson(
  url: string,
  source: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetchOrganism(url, source, {
    method: "GET",
    headers: { Accept: "application/solr+json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`${source}: ${await responseErrorMessage(response)}`);
  }
  return readJsonObject(response, source);
}

/**
 * POST variant of fetchOrganismSolrJson. Used by BV-BRC endpoints (e.g.
 * genome_amr) that require an RQL body via POST instead of GET query params.
 */
export async function fetchOrganismSolrJsonPost(
  url: string,
  body: string,
  source: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetchOrganism(url, source, {
    method: "POST",
    headers: {
      Accept: "application/solr+json",
      "Content-Type": "application/rqlquery+x-www-form-urlencoded",
    },
    body,
    signal,
  });
  if (!response.ok) {
    throw new Error(`${source}: ${await responseErrorMessage(response)}`);
  }
  return readJsonObject(response, source);
}

export async function readJsonObject(response: Response, source: string): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch((error: unknown) => {
    // An abort while the body streams is a timeout or cancellation, not a
    // malformed payload.
    const name = errorName(error);
    if (name === "TimeoutError" || name === "AbortError") {
      throwOrganismFetchError(error, source);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${source}: malformed JSON response: ${message}`);
  })) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${source}: malformed JSON response`);
  }

  return payload as Record<string, unknown>;
}

export function numberOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  // Reject booleans, arrays, and objects up front: `Number(true) === 1`,
  // `Number([5]) === 5`, both pass `Number.isFinite` and silently corrupt data.
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Unexpected BV-BRC response shape: ${field} is not numeric`);
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Unexpected BV-BRC response shape: ${field} is not numeric`);
  }
  return numeric;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Unexpected BV-BRC response shape: ${field} is missing`);
  }
  return value;
}

export function requiredNumber(value: unknown, field: string): number {
  const numeric = numberOrNull(value, field);
  if (numeric === null) {
    throw new Error(`Unexpected BV-BRC response shape: ${field} is missing`);
  }
  return numeric;
}

export function parseSolrFacetList(payload: Record<string, unknown>, field: string): { name: string; count: number }[] {
  const facetCounts = payload.facet_counts;
  if (!facetCounts || typeof facetCounts !== "object" || Array.isArray(facetCounts)) {
    throw new Error(`Unexpected SOLR response shape: missing facet_counts`);
  }

  const facetFields = (facetCounts as Record<string, unknown>).facet_fields;
  if (!facetFields || typeof facetFields !== "object" || Array.isArray(facetFields)) {
    throw new Error(`Unexpected SOLR response shape: missing facet_fields`);
  }

  const rawFacet = (facetFields as Record<string, unknown>)[field];
  if (!Array.isArray(rawFacet)) {
    throw new Error(`Unexpected SOLR response shape: missing ${field} facet`);
  }

  const values: { name: string; count: number }[] = [];
  for (let index = 0; index < rawFacet.length; index += 2) {
    const name: unknown = rawFacet[index];
    const count: unknown = rawFacet[index + 1];
    if (typeof name !== "string") {
      throw new Error(`Unexpected SOLR response shape: ${field} facet label is invalid`);
    }
    values.push({ name, count: requiredNumber(count, `${field} count`) });
  }

  return values;
}

export function buildGenomeFacetUrl(baseUrl: string, taxonId: number, field: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?eq(taxon_lineage_ids,${String(taxonId)})&limit(1)&facet((field,${field})${limitClause},(mincount,1))`;
}

export function buildGenomeGeoFacetUrl(baseUrl: string, taxonId: number, field: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?eq(genome_id,*)&genome(eq(taxon_lineage_ids,${String(taxonId)}))&facet((field,${field}),(mincount,1)${limitClause})&limit(0)`;
}

export function buildGenomeGeoPivotUrl(baseUrl: string, taxonId: number, primary: string, secondary: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?eq(genome_id,*)&genome(eq(taxon_lineage_ids,${String(taxonId)}))&facet((pivot,(${primary},${secondary})),(mincount,1)${limitClause})&limit(0)`;
}

export function buildGenomeGeoPivot3Url(baseUrl: string, taxonId: number, primary: string, secondary: string, tertiary: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?eq(genome_id,*)&genome(eq(taxon_lineage_ids,${String(taxonId)}))&facet((pivot,(${primary},${secondary},${tertiary})),(mincount,1)${limitClause})&limit(0)`;
}

interface PivotEntry {
  value?: unknown;
  count?: unknown;
  pivot?: unknown;
}

function pivotEntryName(entry: PivotEntry): string | null {
  // SOLR emits numeric outer keys (e.g. collection_year) as numbers OR
  // strings depending on field type; coerce to string for the result map.
  if (typeof entry.value === "string" && entry.value.length > 0) return entry.value;
  if (typeof entry.value === "number" && Number.isFinite(entry.value)) return String(entry.value);
  return null;
}

function pivotEntryCount(entry: PivotEntry): number | null {
  if (typeof entry.count === "number" && Number.isFinite(entry.count)) return entry.count;
  if (typeof entry.count === "string") {
    const numeric = Number(entry.count);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function readFacetPivotArray(payload: Record<string, unknown>, pivotKey: string): PivotEntry[] {
  const facetCounts = payload.facet_counts;
  if (!facetCounts || typeof facetCounts !== "object" || Array.isArray(facetCounts)) {
    throw new Error(`Unexpected SOLR response shape: missing facet_counts`);
  }

  const facetPivot = (facetCounts as Record<string, unknown>).facet_pivot;
  if (!facetPivot || typeof facetPivot !== "object" || Array.isArray(facetPivot)) {
    throw new Error(`Unexpected SOLR response shape: missing facet_pivot`);
  }

  const rawPivot = (facetPivot as Record<string, unknown>)[pivotKey];
  if (!Array.isArray(rawPivot)) {
    throw new Error(`Unexpected SOLR response shape: missing ${pivotKey} pivot`);
  }

  return rawPivot as PivotEntry[];
}

export function parseSolrFacetPivot(payload: Record<string, unknown>, pivotKey: string): Record<string, Record<string, number>> {
  const rawPivot = readFacetPivotArray(payload, pivotKey);
  const result: Record<string, Record<string, number>> = {};
  for (const entry of rawPivot) {
    if (typeof entry !== "object") continue;
    const name = pivotEntryName(entry);
    if (name === null) continue;
    const inner: Record<string, number> = {};
    if (Array.isArray(entry.pivot)) {
      for (const sub of entry.pivot as PivotEntry[]) {
        if (typeof sub !== "object") continue;
        const subName = pivotEntryName(sub);
        if (subName === null) continue;
        const subCount = pivotEntryCount(sub);
        if (subCount !== null) inner[subName] = subCount;
      }
    }
    result[name] = inner;
  }
  return result;
}

export function parseSolrFacetPivot3(payload: Record<string, unknown>, pivotKey: string): Record<string, Record<string, Record<string, number>>> {
  const rawPivot = readFacetPivotArray(payload, pivotKey);
  const result: Record<string, Record<string, Record<string, number>>> = {};
  for (const entry of rawPivot) {
    if (typeof entry !== "object") continue;
    const outerName = pivotEntryName(entry);
    if (outerName === null) continue;
    const middle: Record<string, Record<string, number>> = {};
    if (Array.isArray(entry.pivot)) {
      for (const sub of entry.pivot as PivotEntry[]) {
        if (typeof sub !== "object") continue;
        const middleName = pivotEntryName(sub);
        if (middleName === null) continue;
        const leaf: Record<string, number> = {};
        if (Array.isArray(sub.pivot)) {
          for (const leafEntry of sub.pivot as PivotEntry[]) {
            if (typeof leafEntry !== "object") continue;
            const leafName = pivotEntryName(leafEntry);
            if (leafName === null) continue;
            const leafCount = pivotEntryCount(leafEntry);
            if (leafCount !== null) leaf[leafName] = leafCount;
          }
        }
        middle[middleName] = leaf;
      }
    }
    result[outerName] = middle;
  }
  return result;
}

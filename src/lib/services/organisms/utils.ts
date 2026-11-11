import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  hostOf,
  isHtmlBody,
  summarizeUpstreamBody,
  UpstreamError,
  upstreamServices,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "@/lib/env";

import { genomeScopeRql, type GenomeScope } from "./genome-scope";

export const numberFormatter = new Intl.NumberFormat("en-US");

export const organismBvBrcRevalidateSeconds = 86400;

// The budget only needs to stop true hangs: BV-BRC's gateway answers 500 after
// ~20 s, and slow-but-good responses take 5–15 s. A timed-out response is never
// cached, so a lower budget would keep a slow endpoint failing for every
// visitor.
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

/**
 * A non-OK response as one log line: the body's text, or only the status and
 * title of an HTML error page, never page source.
 */
export async function responseErrorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const status = `${String(response.status)} ${response.statusText}`.trim();
  const contentType = response.headers.get("content-type");
  if (isHtmlBody(body, contentType)) {
    const summary = summarizeUpstreamBody(body, contentType);
    return summary ? `${status}: ${summary}` : status;
  }
  return body.trim() || status;
}

// Matched by name: an abort's DOMException can come from another realm (jsdom),
// where instanceof fails.
function errorName(error: unknown): unknown {
  return typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
}

const organismService = upstreamServices.dataApi;

/**
 * What an organism request fetches: `label` is the user-facing name (omit it
 * where the card already names the data), `source` is the endpoint name for the
 * server log.
 */
export interface OrganismRequest {
  source: string;
  label?: string;
}

function labelled(request: OrganismRequest, message: string): string {
  return request.label ? `${request.label}: ${message}` : message;
}

/**
 * The `UpstreamError` for a non-OK organism response, worded by
 * `describeUpstreamResponse` behind the request's label; the host goes on
 * `host` and the endpoint on `source`.
 */
export async function organismResponseError(
  response: Response,
  request: OrganismRequest,
): Promise<UpstreamError> {
  const body = await response.text().catch(() => "");
  const failure = describeUpstreamResponse(response, body, organismService, {
    host: response.url ? hostOf(response.url) : undefined,
  });
  return new UpstreamError({
    ...failure,
    message: labelled(request, failure.message),
    source: request.source,
  });
}

/**
 * Rethrows a failed organism request: a spent budget or network failure becomes
 * an `UpstreamError` naming the service; a caller's own abort and anything else
 * is rethrown untouched.
 */
export function throwOrganismFetchError(
  error: unknown,
  request: OrganismRequest,
  url?: string,
): never {
  const failure = describeUpstreamFailure(error, organismService, {
    timeoutMs: organismFetchTimeoutMs,
    host: url ? hostOf(url) : undefined,
  });
  if (failure) {
    throw new UpstreamError(
      {
        ...failure,
        message: labelled(request, failure.message),
        source: request.source,
      },
      { cause: error },
    );
  }
  throw error;
}

/**
 * fetch() for BV-BRC organism endpoints with the shared cache policy and
 * timeout. A `token` makes it the signed-in user's request: never cached,
 * redirects and plain HTTP refused.
 */
export async function fetchOrganism(
  url: string,
  request: OrganismRequest,
  init: RequestInit = {},
  token?: string,
): Promise<Response> {
  if (token && new URL(url).protocol !== "https:") {
    throw new Error(
      labelled(request, "Authenticated data service requests require HTTPS."),
    );
  }
  const timeout = AbortSignal.timeout(organismFetchTimeoutMs);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", token);
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      ...(token
        ? { cache: "no-store" as const, redirect: "error" as const }
        : organismFetchCacheInit(organismBvBrcRevalidateSeconds)),
    });
  } catch (error) {
    // The caller's own cancellation is theirs, whatever its reason.
    if (init.signal?.aborted) throw error;
    throwOrganismFetchError(error, request, url);
  }
}

/**
 * Standard SOLR/BV-BRC fetch wrapper: Accept header, cache, timeout, error
 * extraction, JSON-object validation.
 */
export async function fetchOrganismSolrJson(
  url: string,
  request: OrganismRequest,
  signal?: AbortSignal,
  token?: string,
): Promise<Record<string, unknown>> {
  const response = await fetchOrganism(
    url,
    request,
    {
      method: "GET",
      headers: { Accept: "application/solr+json" },
      signal,
    },
    token,
  );
  if (!response.ok) throw await organismResponseError(response, request);
  return readJsonObject(response, request);
}

/** POST variant for endpoints (e.g. genome_amr) that require an RQL body. */
export async function fetchOrganismSolrJsonPost(
  url: string,
  body: string,
  request: OrganismRequest,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetchOrganism(url, request, {
    method: "POST",
    headers: {
      Accept: "application/solr+json",
      "Content-Type": "application/rqlquery+x-www-form-urlencoded",
    },
    body,
    signal,
  });
  if (!response.ok) throw await organismResponseError(response, request);
  return readJsonObject(response, request);
}

export async function readJsonObject(
  response: Response,
  request: OrganismRequest,
): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch((error: unknown) => {
    // An abort while the body streams is a timeout or cancellation, not a
    // malformed payload.
    const name = errorName(error);
    if (name === "TimeoutError" || name === "AbortError") {
      throwOrganismFetchError(error, request, response.url || undefined);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(labelled(request, `Malformed JSON response: ${message}`));
  })) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(labelled(request, "Malformed JSON response"));
  }

  return payload as Record<string, unknown>;
}

export function numberOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  // Reject booleans, arrays, and objects up front: `Number(true)` and
  // `Number([5])` pass `Number.isFinite` and silently corrupt data.
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

export function buildGenomeFacetUrl(baseUrl: string, scope: GenomeScope, field: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?${genomeScopeRql(scope)}&limit(1)&facet((field,${field})${limitClause},(mincount,1))`;
}

export function buildGenomeGeoFacetUrl(baseUrl: string, scope: GenomeScope, field: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?${genomeScopeRql(scope)}&facet((field,${field}),(mincount,1)${limitClause})&limit(0)`;
}

export function buildGenomeGeoPivotUrl(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?${genomeScopeRql(scope)}&facet((pivot,(${primary},${secondary})),(mincount,1)${limitClause})&limit(0)`;
}

export function buildGenomeGeoPivot3Url(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, tertiary: string, limit?: number): string {
  const limitClause = typeof limit === "number" && limit > 0 ? `,(limit,${String(limit)})` : "";
  return `${baseUrl}/genome/?${genomeScopeRql(scope)}&facet((pivot,(${primary},${secondary},${tertiary})),(mincount,1)${limitClause})&limit(0)`;
}

interface PivotEntry {
  value?: unknown;
  count?: unknown;
  pivot?: unknown;
}

function pivotEntryName(entry: PivotEntry): string | null {
  // SOLR emits numeric outer keys as numbers or strings by field type; coerce
  // to string.
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

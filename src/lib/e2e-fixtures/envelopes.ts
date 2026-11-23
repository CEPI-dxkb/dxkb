/** Transport-specific envelope builders for E2E fixture records: the browser-side gateway uses the app's `{ rows, total, facets, page, pageSize }` shape, the loopback mirrors Solr's `{ response: { numFound, docs } }`. */

export interface FacetCount {
  value: string | number;
  count: number;
}

export type GatewayFacets = Record<string, FacetCount[]>;

export interface GatewayCollectionEnvelope<T> {
  rows: T[];
  total: number;
  facets: GatewayFacets;
  page: number;
  pageSize: number;
}

export function buildGatewayCollectionEnvelope<T>(
  rows: T[],
  options: {
    total?: number;
    facets?: GatewayFacets;
    page?: number;
    pageSize?: number;
  } = {},
): GatewayCollectionEnvelope<T> {
  return {
    rows,
    total: options.total ?? rows.length,
    facets: options.facets ?? {},
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 200,
  };
}

export function buildGatewayRowsEnvelope<T>(rows: T[]): { rows: T[] } {
  return { rows };
}

/**
 * The gateway's `export` answer: the requested window of the matching rows, and `total`, the count
 * of all of them, which the real gateway reads from the Data API's `Content-Range`.
 */
export function buildGatewayExportEnvelope<T>(
  matching: T[],
  window: { limit: number; offset?: number },
): { rows: T[]; total: number } {
  const offset = window.offset ?? 0;
  return {
    rows: matching.slice(offset, offset + window.limit),
    total: matching.length,
  };
}

export interface SolrFacetFields {
  facet_fields: Record<string, (string | number)[]>;
}

export interface LoopbackSolrEnvelope<T> {
  response: { numFound: number; docs: T[] };
  facet_counts?: SolrFacetFields;
}

export function buildLoopbackSolrEnvelope<T>(
  docs: T[],
  options: { facetCounts?: SolrFacetFields; numFound?: number } = {},
): LoopbackSolrEnvelope<T> {
  const envelope: LoopbackSolrEnvelope<T> = {
    response: { numFound: options.numFound ?? docs.length, docs },
  };
  if (options.facetCounts) envelope.facet_counts = options.facetCounts;
  return envelope;
}

/** Loopback RPC builders emit the full wire shape (`id` + `jsonrpc`); browser-side builders emit the payload only, since `JsonRpcClient` reads just `result`/`error`. */

export interface JsonRpcSuccessEnvelope<T> {
  id: number;
  jsonrpc: "2.0";
  result: T;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
}

export interface JsonRpcErrorEnvelope {
  id: number;
  jsonrpc: "2.0";
  error: JsonRpcErrorBody;
}

export function buildLoopbackRpcSuccess<T>(
  result: T,
  id = 1,
): JsonRpcSuccessEnvelope<T> {
  return { id, jsonrpc: "2.0", result };
}

export function buildLoopbackRpcError(
  code: number,
  message: string,
  id = 1,
): JsonRpcErrorEnvelope {
  return { id, jsonrpc: "2.0", error: { code, message } };
}

export function buildBrowserRpcSuccess<T>(result: T): { result: T } {
  return { result };
}

export function buildBrowserRpcError(
  code: number,
  message: string,
): { error: JsonRpcErrorBody } {
  return { error: { code, message } };
}

/**
 * Transport-specific envelope builders for E2E fixture records.
 *
 * The canonical records in `./records.ts` are plain domain data with no
 * knowledge of transport. Each mock layer wraps them differently:
 *
 *   - Browser-side gateway (`/api/data/<resource>`, same-origin, intercepted
 *     by `applyBackendMocks` in e2e/fixtures/overrides/catchall.ts) uses the
 *     app's own `{ rows, total, facets, page, pageSize }` collection shape
 *     for GET, and `{ rows }` for POST (selection/export operations).
 *   - Server-side loopback (`/api/e2e-mock/data/<resource>`, reached because
 *     `.env.e2e.test` rewrites backend URLs there — see
 *     src/app/api/e2e-mock/[...path]/route.ts) mirrors the real Solr
 *     response envelope: `{ response: { numFound, docs }, facet_counts? }`.
 *
 * Keeping the wrapping here — instead of duplicating envelope literals next
 * to every record — means a record fixed once (e.g. the epitope `host_name`
 * drift) is correct in both transports automatically.
 */

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

/** Browser-side gateway GET envelope — `/api/data/<resource>` collection responses. */
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

/** Browser-side gateway POST envelope — `/api/data/<resource>` selection/export operations. */
export function buildGatewayRowsEnvelope<T>(rows: T[]): { rows: T[] } {
  return { rows };
}

export interface SolrFacetFields {
  facet_fields: Record<string, (string | number)[]>;
}

export interface LoopbackSolrEnvelope<T> {
  response: { numFound: number; docs: T[] };
  facet_counts?: SolrFacetFields;
}

/** Server-side loopback envelope — mirrors the real Solr response shape. */
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

/**
 * JSON-RPC 2.0 envelopes.
 *
 * The two transports read different parts of the same envelope, so there are
 * two pairs rather than one shared builder:
 *
 *   - `buildLoopbackRpc*` — the full wire shape (`id` + `jsonrpc` + payload).
 *     The loopback mock answers a real HTTP request that `JsonRpcClient`
 *     (src/lib/jsonrpc-client.ts) parses, so the envelope has to be complete.
 *   - `buildBrowserRpc*` — payload only. A `page.route()` override is handed
 *     straight to the same client, which reads `result` / `error` and ignores
 *     `id` / `jsonrpc`, so the browser fixtures have always omitted them; the
 *     builders keep that deliberate difference visible instead of quietly
 *     making the two shapes look identical.
 *
 * Both pairs are used by explicit method dispatch only — the loopback's
 * dispatch table in src/app/api/e2e-mock/[...path]/route.ts and the named
 * per-method overrides in e2e/fixtures/overrides/. No builder here exists
 * without a dispatch site that calls it.
 */

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

/** Server-side loopback JSON-RPC success — full `{id, jsonrpc, result}` wire shape. */
export function buildLoopbackRpcSuccess<T>(
  result: T,
  id = 1,
): JsonRpcSuccessEnvelope<T> {
  return { id, jsonrpc: "2.0", result };
}

/** Server-side loopback JSON-RPC error — full `{id, jsonrpc, error}` wire shape. */
export function buildLoopbackRpcError(
  code: number,
  message: string,
  id = 1,
): JsonRpcErrorEnvelope {
  return { id, jsonrpc: "2.0", error: { code, message } };
}

/** Browser-side override JSON-RPC success — the client reads only `result`. */
export function buildBrowserRpcSuccess<T>(result: T): { result: T } {
  return { result };
}

/** Browser-side override JSON-RPC error — the client reads only `error`. */
export function buildBrowserRpcError(
  code: number,
  message: string,
): { error: JsonRpcErrorBody } {
  return { error: { code, message } };
}

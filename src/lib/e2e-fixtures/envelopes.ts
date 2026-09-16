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

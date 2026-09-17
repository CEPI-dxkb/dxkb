import {
  buildBrucellaPpiRecords,
  type PpiFixtureRecord,
} from "@/lib/e2e-fixtures/records";
import {
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackSolrEnvelope,
} from "@/lib/e2e-fixtures/envelopes";
import type { JsonOverride } from "../../mocks/backends";

// Match the resource path independently of origin. NEXT_PUBLIC_DATA_API is embedded
// at build time, so a build made without .env.e2e.test can still target the public
// API while Playwright intercepts it before any network request leaves the browser.
const ppiRequest = /\/ppi\//;
// The count query is the only PPI request ending in limit(1). Keep the end anchor so
// facet requests containing limit(1) continue to fall through to the row fixture.
const ppiCountRequest = /\/ppi\/.*limit(?:\(1\)|%281%29)$/;

/**
 * Row shape and values now live with every other canonical fixture in
 * `src/lib/e2e-fixtures/records.ts`, so the loopback mock and this browser
 * bundle cannot drift apart on "what a Brucella PPI row looks like". Only the
 * per-transport wrapping stays here.
 */
export type MockPpiRow = PpiFixtureRecord;

/** Build `count` synthetic PPI rows for the Brucella melitensis (taxon 234) fixture. */
export const buildPpiRows = buildBrucellaPpiRecords;

/** Build origin-independent PPI count and row overrides for browser requests. */
export function buildPpiOverrides(rows: MockPpiRow[]): JsonOverride[] {
  return [
    // Narrowest first: matching is first-match, and the count URL also satisfies both broad
    // patterns below, so any broad entry placed ahead of it would swallow the count request.
    {
      url: ppiCountRequest,
      method: "GET",
      body: buildLoopbackSolrEnvelope([], { numFound: rows.length }),
    },
    {
      url: /api\/data\/ppi/,
      method: "GET",
      body: buildGatewayCollectionEnvelope(rows),
    },
    // The Graph reads its dataset through the gateway's bulk-row POST now, not by
    // fetching NEXT_PUBLIC_DATA_API itself, so it shares the Table's auth,
    // validation and error contract. That envelope is rows-only.
    {
      url: /api\/data\/ppi/,
      method: "POST",
      body: buildGatewayRowsEnvelope(rows),
    },
    { url: ppiRequest, method: "GET", body: rows },
  ];
}

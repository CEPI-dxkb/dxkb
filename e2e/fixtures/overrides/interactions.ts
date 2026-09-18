import {
  buildBrucellaPpiRecords,
  type PpiFixtureRecord,
} from "@/lib/e2e-fixtures/records";
import {
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackSolrEnvelope,
} from "@/lib/e2e-fixtures/envelopes";
import type {
  JsonOverride,
  JsonOverrideBodyContext,
} from "../../mocks/backends";

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

function keywordFromRequest({
  parsedBody,
  requestUrl,
}: JsonOverrideBodyContext): string | undefined {
  const url = new URL(requestUrl);
  if (url.pathname === "/api/data/ppi") {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "keyword" in parsedBody
    ) {
      const keyword = parsedBody.keyword;
      return typeof keyword === "string" ? keyword : undefined;
    }
    return url.searchParams.get("keyword") ?? undefined;
  }
  return /keyword\(([^*)]+)\*?\)/.exec(decodeURIComponent(requestUrl))?.[1];
}

export function selectPpiRows(
  rows: MockPpiRow[],
  context: JsonOverrideBodyContext,
): MockPpiRow[] {
  const body = context.parsedBody as {
    operation?: string;
    ids?: unknown;
  } | null;
  if (body?.operation === "selected" && Array.isArray(body.ids)) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return body.ids.flatMap((id) => {
      if (typeof id !== "string") return [];
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }
  const keyword = keywordFromRequest(context);
  return keyword
    ? rows.filter((row) => JSON.stringify(row).includes(keyword))
    : rows;
}

/** Build origin-independent PPI count and row overrides for browser requests. */
export function buildPpiOverrides(rows: MockPpiRow[]): JsonOverride[] {
  return [
    // Narrowest first: matching is first-match, and the count URL also satisfies both broad
    // patterns below, so any broad entry placed ahead of it would swallow the count request.
    {
      url: ppiCountRequest,
      method: "GET",
      body: (context) =>
        buildLoopbackSolrEnvelope([], {
          numFound: selectPpiRows(rows, context).length,
        }),
    },
    {
      url: /api\/data\/ppi/,
      method: "GET",
      body: (context) =>
        buildGatewayCollectionEnvelope(selectPpiRows(rows, context)),
    },
    // The Graph reads its dataset through the gateway's bulk-row POST now, not by
    // fetching NEXT_PUBLIC_DATA_API itself, so it shares the Table's auth,
    // validation and error contract. That envelope is rows-only.
    {
      url: /api\/data\/ppi/,
      method: "POST",
      body: (context) => buildGatewayRowsEnvelope(selectPpiRows(rows, context)),
    },
    {
      url: ppiRequest,
      method: "GET",
      body: (context) => selectPpiRows(rows, context),
    },
  ];
}

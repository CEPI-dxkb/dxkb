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

// Matched independent of origin: NEXT_PUBLIC_DATA_API is embedded at build
// time and may differ.
const ppiRequest = /\/ppi\//;
// The count query is the only PPI request ending in limit(1); keep the end
// anchor so facet requests fall through.
const ppiCountRequest = /\/ppi\/.*limit(?:\(1\)|%281%29)$/;

export type MockPpiRow = PpiFixtureRecord;

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

export function buildPpiOverrides(rows: MockPpiRow[]): JsonOverride[] {
  return [
    // Narrowest first (first match wins): the count URL also satisfies both
    // broad patterns below.
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
    // The Graph reads through the gateway's bulk-row POST, whose envelope is
    // rows-only.
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

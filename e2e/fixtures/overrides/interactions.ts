import {
  buildBrucellaPpiRecords,
  type PpiFixtureRecord,
} from "@/lib/e2e-fixtures/records";
import {
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackSolrEnvelope,
  type FacetCount,
  type GatewayCollectionEnvelope,
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

/**
 * The values `rows` hold for `field`, most common first; a list field (`interaction_type`,
 * `evidence`) counts each of its values.
 */
function facetBuckets(rows: MockPpiRow[], field: string): FacetCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value: unknown = (row as unknown as Record<string, unknown>)[field];
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item !== "string" || item === "") continue;
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * The gateway's collection read (`GET /api/data/ppi`): one page of the rows matching the keyword,
 * the count of all of them (the truncation banner's count and every Filters menu count read
 * `pageSize=1` for it) and a bucket list per `facet=` param. Like the rest of this mock it ignores
 * `rql`, so a filter pick narrows nothing and the counts are the keyword's.
 */
export function buildPpiCollectionEnvelope(
  rows: MockPpiRow[],
  context: JsonOverrideBodyContext,
): GatewayCollectionEnvelope<MockPpiRow> {
  const matching = selectPpiRows(rows, context);
  const params = new URL(context.requestUrl).searchParams;
  const pageSize = Number(params.get("pageSize")) || undefined;
  const page = Number(params.get("page")) || 1;
  return buildGatewayCollectionEnvelope(
    pageSize
      ? matching.slice((page - 1) * pageSize, page * pageSize)
      : matching,
    {
      total: matching.length,
      page,
      pageSize,
      facets: Object.fromEntries(
        params.getAll("facet").map((field) => [field, facetBuckets(matching, field)]),
      ),
    },
  );
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
      body: (context) => buildPpiCollectionEnvelope(rows, context),
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

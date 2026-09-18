/**
 * The Taxa Tree's server-side contract with the Data API `/taxonomy/` resource:
 * the two RQL clauses it sends, its exceptional page bound, its `Content-Range`
 * paging safeguard, and the `facet_counts` header parser.
 *
 * This lives outside `./validation.ts` on purpose. The bound below is far above
 * the generic collection page size and the export ceiling, and nothing here is
 * reachable from `validateDataApiRequest`, so a generic `collection` or
 * `export` request cannot acquire it and this module cannot acquire theirs.
 */
import { DataApiError } from "./repository";
import type { ServerDataRepository } from "./repository";
import { DataApiValidationError } from "./resources";
import { maxRqlInValues } from "./rql";
import type { TaxonChildCountsResult, TaxonChildrenResult } from "./types";

/**
 * One request per node, even for huge levels. The Data API returns 36k children
 * in a single ~2.5s response (4.4 MB), whereas N sequential smaller pages cost
 * N× that. Sized above the largest real taxon level (H1N1 subtype ≈ 35.9k) so
 * the paging loop in `readTaxonChildren` never runs a second time in practice —
 * it stays only as a safety net.
 */
export const taxonChildrenPageSize = 50_000;

/**
 * Content-Range header looks like "items 0-25/126"; the trailing number is the
 * total. Returns null when absent or unparseable, so a caller can substitute a
 * count of its own instead of treating a missing header as zero rows.
 */
export function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const total = Number(header.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

/**
 * RQL for one node's children. Mirrors the legacy taxontree call:
 *   and(gt(genomes,1),eq(parent_id,ID))&sort(+taxon_name)
 * The gt(genomes,1) filter is replicated verbatim for byte-parity with legacy
 * (SOLR returns some genomes:1 strain rows anyway — that quirk is intentional).
 */
export function taxonChildrenClause(parentId: number): string {
  return `and(gt(genomes,1),eq(parent_id,${String(parentId)}))&sort(+taxon_name)`;
}

/**
 * RQL for many parents' child counts in ONE request via SOLR faceting. Uses the
 * same gt(genomes,1) filter as `taxonChildrenClause` so the counts match what
 * expanding a node actually shows. `mincount,1` is what leaves a parent with no
 * qualifying children out of the response entirely.
 */
export function taxonChildCountsClause(parentIds: number[]): string {
  return `and(gt(genomes,1),in(parent_id,(${parentIds.join(",")})))&facet((field,parent_id),(mincount,1))&limit(1)`;
}

function malformedFacets(detail: string): DataApiError {
  return new DataApiError(detail, 502, "malformed_response");
}

/**
 * Parses the Data API's `facet_counts` response header — shaped
 * `{"facet_fields":{"parent_id":["11320",138,"2955291",1]}}`, a flat
 * `[id, count, id, count, …]` array — into a parent id → child count map.
 *
 * Every rejection below is load-bearing: this response decides whether a tree
 * node is interactive, so malformed data must fail rather than silently turn
 * branches into leaves. A parent absent from the result is the *valid* signal
 * that it has no qualifying children (and therefore no expand arrow), which is
 * exactly why a malformed payload must not be allowed to degrade into the same
 * shape as a legitimately empty one.
 *
 * Messages carry no operation prefix; the browser repository
 * (`./taxonomy-tree-client.ts`) prepends "taxonomy child counts: " when it
 * rethrows, so the caller-visible text is unchanged from when this parsing ran
 * in the browser.
 */
export function parseTaxonFacetCounts(
  header: string | null,
  requestedParentIds: readonly number[],
): Map<number, number> {
  if (!header) throw malformedFacets("missing facet_counts header");

  let parsed: unknown;
  try {
    parsed = JSON.parse(header);
  } catch {
    throw malformedFacets("invalid facet_counts JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw malformedFacets("missing facet_fields.parent_id");
  }
  const facetFields = (parsed as { facet_fields?: unknown }).facet_fields;
  if (typeof facetFields !== "object" || facetFields === null) {
    throw malformedFacets("missing facet_fields.parent_id");
  }
  const flat: unknown = (facetFields as { parent_id?: unknown }).parent_id;
  if (!Array.isArray(flat)) {
    throw malformedFacets("missing facet_fields.parent_id");
  }
  if (flat.length % 2 !== 0) {
    throw malformedFacets("expected parent/count pairs");
  }

  const values: unknown[] = flat;
  const requestedIds = new Set(requestedParentIds);
  const counts = new Map<number, number>();
  for (let index = 0; index < values.length; index += 2) {
    const rawParentId: unknown = values[index];
    const rawCount: unknown = values[index + 1];
    const parentId =
      (typeof rawParentId === "string" || typeof rawParentId === "number") &&
      String(rawParentId).trim() !== ""
        ? Number(rawParentId)
        : NaN;
    const count =
      (typeof rawCount === "string" || typeof rawCount === "number") &&
      String(rawCount).trim() !== ""
        ? Number(rawCount)
        : NaN;
    if (!Number.isInteger(parentId) || parentId <= 0) {
      throw malformedFacets(`invalid parent id ${String(rawParentId)}`);
    }
    if (!Number.isInteger(count) || count < 0) {
      throw malformedFacets(`invalid child count ${String(rawCount)}`);
    }
    if (!requestedIds.has(parentId)) {
      throw malformedFacets(`unexpected parent id ${String(parentId)}`);
    }
    if (counts.has(parentId)) {
      throw malformedFacets(`duplicate parent id ${String(parentId)}`);
    }
    counts.set(parentId, count);
  }
  return counts;
}

/**
 * Every child of `parentId`, paging the `Range` header until the
 * `Content-Range` total is reached.
 *
 * Two safeguards survive from the browser implementation this replaces:
 * a response with no `Content-Range` falls back to the number of rows
 * collected *before* this page, which can never exceed the next `start`, so
 * the loop ends after that page rather than requesting a second one; and an
 * empty page breaks the loop even when the total claims more rows are
 * available.
 */
export async function readTaxonChildren(
  repository: ServerDataRepository,
  parentId: number,
  signal?: AbortSignal,
): Promise<TaxonChildrenResult> {
  const clause = taxonChildrenClause(parentId);
  const rows: Record<string, unknown>[] = [];
  let start = 0;
  let total = Infinity;
  while (start < total) {
    const page = await repository.rangedRows(
      "taxonomy",
      clause,
      start,
      // `items=start-(start+pageSize-1)`, byte-identical to the browser fetch
      // this replaces. Note the upstream's range end is *exclusive* — the same
      // convention `collection` relies on when it asks for `start+size` to get
      // `size` rows — so this window yields up to `taxonChildrenPageSize - 1`
      // rows, not exactly that many. It is still far above the largest real
      // taxon level, and the off-by-one cannot drop a row either way: the next
      // `start` is the number of rows actually collected, not the window size.
      start + taxonChildrenPageSize - 1,
      signal,
    );
    total =
      parseContentRangeTotal(page.headers.get("Content-Range")) ?? rows.length;
    // Appended one at a time rather than spread: a full page is tens of
    // thousands of rows, close enough to the engine's argument-count limit to
    // be worth avoiding.
    for (const row of page.rows) rows.push(row);
    if (page.rows.length === 0) break;
    start = rows.length;
  }
  return { rows };
}

/**
 * Child counts for many parents in one faceted request, replacing the per-node
 * prefetch fan-out that caused table lag. Keyed by parent id as a string,
 * because that is what JSON can carry; parents with no qualifying children are
 * absent from the map, which is what suppresses their expand arrow.
 *
 * Requires at least one and at most `maxRqlInValues` parents — the Data API
 * rejects a wider `in(...)` clause outright, so rejecting here turns an
 * unusable upstream request into an actionable 400.
 */
export async function readTaxonChildCounts(
  repository: ServerDataRepository,
  parentIds: number[],
  signal?: AbortSignal,
): Promise<TaxonChildCountsResult> {
  if (parentIds.length === 0)
    throw new DataApiValidationError("At least one parentId is required.");
  if (parentIds.length > maxRqlInValues)
    throw new DataApiValidationError(
      `Child counts are limited to ${maxRqlInValues.toLocaleString()} parents per request.`,
    );
  const headers = await repository.rangedHeaders(
    "taxonomy",
    taxonChildCountsClause(parentIds),
    0,
    0,
    signal,
  );
  const counts = parseTaxonFacetCounts(headers.get("facet_counts"), parentIds);
  return { counts: Object.fromEntries(counts) };
}

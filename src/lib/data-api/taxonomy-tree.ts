/**
 * Server-side contract with `/taxonomy/`. Kept out of `./validation.ts` so a
 * generic collection or export request cannot acquire this module's page bound.
 */
import { DataApiError } from "./repository";
import type { ServerDataRepository } from "./repository";
import { DataApiValidationError } from "./resources";
import { maxRqlInValues } from "./rql";
import type { TaxonChildCountsResult, TaxonChildrenResult } from "./types";

/**
 * One request per node: a 36k-child level is a single ~2.5s response, while
 * sequential smaller pages cost N times that.
 * Sized above the largest real level, so the paging loop is only a safety net.
 */
export const taxonChildrenPageSize = 50_000;

/**
 * Returns null when absent or unparseable, so a caller can substitute its own
 * count rather than treat a missing header as zero rows.
 */
export function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const total = Number(header.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

/**
 * The gt(genomes,1) filter is replicated verbatim for byte-parity with legacy;
 * SOLR returns some genomes:1 rows anyway.
 */
export function taxonChildrenClause(parentId: number): string {
  return `and(gt(genomes,1),eq(parent_id,${String(parentId)}))&sort(+taxon_name)`;
}

/**
 * Same gt(genomes,1) filter as `taxonChildrenClause`; `mincount,1` leaves a
 * parent with no qualifying children out of the response.
 */
export function taxonChildCountsClause(parentIds: number[]): string {
  return `and(gt(genomes,1),in(parent_id,(${parentIds.join(",")})))&facet((field,parent_id),(mincount,1))&limit(1)`;
}

function malformedFacets(detail: string): DataApiError {
  return new DataApiError(detail, 502, "malformed_response");
}

/**
 * Every rejection is load-bearing: a malformed payload must fail rather than
 * look like the valid "no children" signal that makes a node a leaf.
 * The browser repository prepends "taxonomy child counts: " to these messages
 * when it rethrows.
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
 * A response with no `Content-Range` falls back to the rows collected before
 * this page, and an empty page ends the loop even if the total claims more.
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
      // The upstream's range end is exclusive, so this window yields up to
      // `taxonChildrenPageSize - 1` rows; the next `start` is the rows actually
      // collected, so none are dropped.
      start + taxonChildrenPageSize - 1,
      signal,
    );
    total =
      parseContentRangeTotal(page.headers.get("Content-Range")) ?? rows.length;
    // Pushed one at a time: spreading tens of thousands of rows risks the
    // engine's argument-count limit.
    for (const row of page.rows) rows.push(row);
    if (page.rows.length === 0) break;
    start = rows.length;
  }
  return { rows };
}

/**
 * Requires at least one and at most `maxRqlInValues` parents: the Data API
 * rejects a wider `in(...)`, so this turns that into an actionable 400.
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

"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  DataRepository,
  DataRepositoryError,
  dataQueryKeys,
  type ExportRequest,
} from "@/lib/data-api";

import { ppiGraphRecordSchema, type PpiRecord } from "./schema";

/**
 * Rows the graph will draw for one query.
 *
 * Sigma's WebGL renderer and the force layouts stop being usable well before
 * this, so the bound is the graph's own rather than the Data API's aggregate
 * `maxExportRows` ceiling. The pre-gateway implementation capped at the same
 * number through a bare `Range: items=0-5000` header, which gave the UI no way
 * to tell a complete result from a truncated one — the query below asks for one
 * row past the ceiling so it can report the overflow instead of hiding it.
 */
export const interactionsGraphRowLimit = 5_000;

/** The fields `toGraph` reads. Mirrors the legacy graph projection. */
export const interactionsGraphFields = [
  "id",
  "interactor_a",
  "interactor_b",
  "interactor_type_a",
  "interactor_type_b",
  "interactor_desc_a",
  "interactor_desc_b",
  "feature_id_a",
  "feature_id_b",
  "gene_a",
  "gene_b",
  "genome_name_a",
  "genome_name_b",
  "refseq_locus_tag_a",
  "refseq_locus_tag_b",
  "domain_a",
  "domain_b",
  "evidence",
  "interaction_type",
  "detection_method",
] as const;

const graphRowsSchema = z.array(ppiGraphRecordSchema);
const graphStaleTimeMs = 5 * 60 * 1_000;
const repository = new DataRepository();

export interface InteractionsGraphData {
  rows: PpiRecord[];
  /** The query matched more rows than `interactionsGraphRowLimit` can draw. */
  isTruncated: boolean;
}

/**
 * The graph's Data API request.
 *
 * `rql` and `keyword` are the whole predicate, and they are exactly the pair the
 * Interactions table sends for the same scope — the shell hands both views the
 * same two values, and the gateway turns `keyword` into the same clauses either
 * way, so one input cannot mean two datasets. `fields` and `limit` only shape
 * the response. Exported so tests can compare the two views' predicates.
 */
export function interactionsGraphRequest(
  rql: string,
  keyword: string,
): Omit<ExportRequest, "operation"> {
  return {
    rql: rql || undefined,
    keyword: keyword || undefined,
    fields: [...interactionsGraphFields],
    limit: interactionsGraphRowLimit + 1,
    // Matches the Table's default sort, so "the first N interactions" names the
    // same N rows the Table would page through, and a refetch of a truncated
    // result returns the same window rather than an arbitrary new one.
    sort: { field: "id", direction: "asc" },
  };
}

/**
 * Load the graph's dataset through the Data API gateway, which owns
 * authentication, RQL validation, rate limiting and the error contract. Missing
 * configuration and every request failure therefore arrive as a rejected query
 * rather than a throw out of this hook, so consumers render their error state
 * instead of unmounting the tree.
 */
export function useInteractions(rql: string, keyword: string) {
  const request = interactionsGraphRequest(rql, keyword);

  return useQuery<InteractionsGraphData>({
    queryKey: dataQueryKeys.export("ppi", request),
    queryFn: async ({ signal }) => {
      const result = await repository.export("ppi", request, signal);
      const parsed = graphRowsSchema.safeParse(result.rows);
      if (!parsed.success) {
        // Same shape and code as the gateway's own row-validation failure, so a
        // malformed row reads like every other standard data error.
        const issue = parsed.error.issues[0];
        const path = issue.path.join(".");
        throw new DataRepositoryError(
          `Malformed ppi response: ${path ? `${path}: ` : ""}${issue.message}`,
          502,
          "malformed_response",
        );
      }
      return {
        rows: parsed.data.slice(0, interactionsGraphRowLimit),
        isTruncated: parsed.data.length > interactionsGraphRowLimit,
      };
    },
    staleTime: graphStaleTimeMs,
  });
}

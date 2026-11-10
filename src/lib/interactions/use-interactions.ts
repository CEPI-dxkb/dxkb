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
 * Sigma's WebGL renderer and force layouts stop being usable well before the Data API's
 * `maxExportRows`; the query asks for one row past this so it can report overflow instead of hiding
 * it.
 */
export const interactionsGraphRowLimit = 5_000;

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
  isTruncated: boolean;
}

/**
 * `rql` and `keyword` are exactly the pair the Interactions table sends for the same scope, so one
 * input cannot mean two datasets. Exported so tests can compare the two views' predicates.
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
    // Matches the Table's default sort, so a truncated result is the Table's first rows and a
    // refetch returns the same window.
    sort: { field: "id", direction: "asc" },
  };
}

/**
 * Missing configuration and every request failure arrive as a rejected query rather than a throw,
 * so consumers render their error state instead of unmounting the tree.
 */
export function useInteractions(rql: string, keyword: string) {
  const request = interactionsGraphRequest(rql, keyword);

  return useQuery<InteractionsGraphData>({
    queryKey: dataQueryKeys.export("ppi", request),
    queryFn: async ({ signal }) => {
      const result = await repository.export("ppi", request, signal);
      const parsed = graphRowsSchema.safeParse(result.rows);
      if (!parsed.success) {
        // Same shape and code as the gateway's row-validation failure, so a malformed row reads
        // like any standard data error.
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

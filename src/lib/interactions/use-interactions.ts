"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  DataRepository,
  DataRepositoryError,
  dataQueryKeys,
  type ExportRequest,
} from "@/lib/data-api";
import { fetchSelectedRows } from "@/lib/data-api/selected-rows";

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
 * A Table selection shown in the Graph. `version` is new for every Show in Graph, so the query key
 * stays small (up to 5,000 ids would be hashed on every render) and a repeated pick of the same
 * rows still reads afresh.
 */
export interface InteractionsSelection {
  ids: readonly string[];
  version: number;
}

function parseGraphRows(rows: unknown): PpiRecord[] {
  const parsed = graphRowsSchema.safeParse(rows);
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
  return parsed.data;
}

/**
 * Missing configuration and every request failure arrive as a rejected query rather than a throw,
 * so consumers render their error state instead of unmounting the tree.
 *
 * With a `selection` the rows are read by id through the `selected` operation, which carries no
 * scope, keyword or filters, so `rql` and `keyword` do not apply; a selection is at most
 * `interactionsGraphRowLimit` rows, so it is never truncated.
 */
export function useInteractions(
  rql: string,
  keyword: string,
  selection?: InteractionsSelection | null,
) {
  const request = interactionsGraphRequest(rql, keyword);

  return useQuery<InteractionsGraphData>(
    selection
      ? {
          queryKey: ["interactions-graph-selected", selection.version],
          queryFn: async () => {
            const rows = await fetchSelectedRows(
              repository,
              "ppi",
              "id",
              selection.ids,
              interactionsGraphFields,
            );
            return { rows: parseGraphRows(rows), isTruncated: false };
          },
          staleTime: graphStaleTimeMs,
        }
      : {
          queryKey: dataQueryKeys.export("ppi", request),
          queryFn: async ({ signal }) => {
            const result = await repository.export("ppi", request, signal);
            const rows = parseGraphRows(result.rows);
            return {
              rows: rows.slice(0, interactionsGraphRowLimit),
              isTruncated: rows.length > interactionsGraphRowLimit,
            };
          },
          staleTime: graphStaleTimeMs,
        },
  );
}

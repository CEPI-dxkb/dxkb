import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

import { genomeFields } from "@/constants/datafields/genome";
import type { DataField } from "@/constants/datafields/types";

export const genomeSorts = (Object.values(genomeFields) as DataField[])
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

export type GenomeSort = string;

export const recentGenomeRql =
  "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))";

export function genomeBaseRql(state: CollectionState): string | undefined {
  return state.rql ? undefined : recentGenomeRql;
}

export const genomeCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...genomeSorts],
  friendlyFilters: [
    "taxon_id",
    "genome_status",
    "genome_quality",
    "collection_year",
    "isolation_country",
    "host_common_name",
  ],
  filterFieldMap: { taxon_id: "taxon_lineage_ids" },
};

export function parseGenomeCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, genomeCollectionOptions);
  if (state.rql) state.rql = validateRql("genome", state.rql);
  return state;
}

// Genome's remap table is total and authoritative: a friendly filter name
// absent from it is dropped rather than forwarded, so a future friendly
// filter can't reach the backend under its raw name before this table is
// updated. Every other structural-filter module passes unmapped names
// through unchanged (see structuralFilterRql's `unknownFilters` option).
const genomeStructuralFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
  genome_status: "genome_status",
  genome_quality: "genome_quality",
  collection_year: "collection_year",
  isolation_country: "isolation_country",
  host_common_name: "host_common_name",
};

export function genomeStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("genome", state, {
    fieldMap: genomeStructuralFieldMap,
    unknownFilters: "drop",
  });
}

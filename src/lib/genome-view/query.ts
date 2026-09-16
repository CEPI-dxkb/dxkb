import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import {
  structuralFilterRql,
  taxonLineageFieldMap,
} from "@/lib/views/structural-rql";

import { genomeMetadata } from "./fields";

export const genomeSorts = genomeMetadata.sorts;

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
//
// "Total" is why it is derived from `friendlyFilters` rather than restating
// those six names: the two lists have to agree by construction, or adding a
// friendly filter here silently drops it at the backend boundary. Each name
// maps to itself except the shared taxonomic-lineage remap.
const genomeStructuralFieldMap: Readonly<Record<string, string>> =
  Object.fromEntries(
    (genomeCollectionOptions.friendlyFilters ?? []).map((name) => [
      name,
      taxonLineageFieldMap[name] ?? name,
    ]),
  );

export function genomeStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("genome", state, {
    fieldMap: genomeStructuralFieldMap,
    unknownFilters: "drop",
  });
}

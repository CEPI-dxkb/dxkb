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

export const recentGenomeRql =
  "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))";

/**
 * The recent-genomes default applies only to an otherwise unscoped list. An
 * explicit RQL query replaces it, and so does a `public` visibility filter:
 * "My Genomes" (`public=false`) must list every private genome, not just the
 * ones completed in the last year. A keyword search replaces it too, as legacy
 * BV-BRC's does (`keyword(...)` alone), so a search lists every genome it
 * matches.
 */
export function genomeBaseRql(state: CollectionState): string | undefined {
  return state.rql || state.keyword || Object.hasOwn(state.filters, "public")
    ? undefined
    : recentGenomeRql;
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
    // Visibility scope behind the "My Genomes" link. A friendly filter rather
    // than `rql` so selecting a facet adds to it instead of replacing it.
    "public",
  ],
  // `public` is a boolean field; the gateway rejects any other value.
  filterValues: { public: ["true", "false"] },
};

export function parseGenomeCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, genomeCollectionOptions);
  if (state.rql) state.rql = validateRql("genome", state.rql);
  return state;
}

// Derived from `friendlyFilters` so the two lists agree by construction: each
// friendly filter name maps to itself, except the shared taxonomic-lineage
// remap. Restating the names here instead would let the lists drift.
//
// Genome pairs this with `unknownFilters: "drop"` (every other
// structural-filter module passes unmapped names through unchanged). Note what
// that does and does not buy, because deriving the table changed it: since
// `parseCollectionState` only admits names in `friendlyFilters`, and every
// admitted name is a key here by construction, "drop" is unreachable for
// URL-derived state. It still guards a caller that hands `structuralFilterRql`
// a hand-built `CollectionState`. A new friendly filter therefore reaches the
// backend under its raw name automatically — which is the intended behaviour
// for a field whose Solr name matches, but it is NOT a tripwire forcing this
// table to be updated first. Add the entry when the Solr name differs.
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

import { eq, type DataResource } from "@/lib/data-api";

import type { CollectionState } from "./collection-state";
import { rqlAnd, rqlAnyOf } from "./rql";

/**
 * Shared by every resource with a taxonomic lineage: `taxon_id` means "anywhere
 * in this lineage" via `taxon_lineage_ids`.
 * Taxonomy is deliberately not a consumer, since `taxon_id` is already its own
 * id field; resources opt in.
 */
export const taxonLineageFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
};

export interface StructuralFilterOptions {
  fieldMap?: Readonly<Record<string, string>>;
  /**
   * `"passthrough"` (default) forwards the name as the backend field. `"drop"`
   * omits it: Genome's remap table is the authoritative list of what it sends,
   * so an unlisted name fails closed.
   */
  unknownFilters?: "passthrough" | "drop";
}

/**
 * Builds the clause for `state.filters` only. An explicit `state.rql` is not
 * folded in here: `ResourceCollection` ANDs it with this clause, so a facet
 * pick narrows a custom query. Every friendly filter stays beside an rql
 * (`filtersBesideRql` in the collection state); the collection state
 * (`defaultShadowed` / `implicitDefault`) decides only whether a default value
 * applies implicitly.
 */
export function structuralFilterRql(
  resource: DataResource,
  state: CollectionState,
  options: StructuralFilterOptions = {},
): string | undefined {
  const { fieldMap = {}, unknownFilters = "passthrough" } = options;
  const clauses = Object.entries(state.filters).flatMap(([name, selected]) => {
    const field = fieldMap[name] ?? (unknownFilters === "drop" ? undefined : name);
    if (!field) return [];
    const predicates = selected.map((value) => eq(resource, field, value));
    return predicates.length === 0 ? [] : [rqlAnyOf(predicates)];
  });
  if (clauses.length === 0) return undefined;
  return rqlAnd(...clauses);
}

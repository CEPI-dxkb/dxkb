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
 * An explicit `state.rql` bypasses friendly filters entirely (returns
 * `undefined`).
 * Feature's wrapper is the exception: its independent `filter` and PATRIC
 * default stay beside `state.rql` (`filtersBesideRql`), and any view giving
 * another resource `defaultFilters` needs the same.
 */
export function structuralFilterRql(
  resource: DataResource,
  state: CollectionState,
  options: StructuralFilterOptions = {},
): string | undefined {
  if (state.rql) return undefined;
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

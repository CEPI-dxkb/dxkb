import { eq, type DataResource } from "@/lib/data-api";

import type { CollectionState } from "./collection-state";

/**
 * The one remap shared by every resource that carries a taxonomic lineage: the
 * friendly `taxon_id` filter means "anywhere in this organism's lineage", which
 * the Data API expresses through the multi-valued `taxon_lineage_ids` field.
 * Epitope, Experiment, Genome, Protein Structure and Strain all read it, so the
 * fact lives here once rather than restated per sibling module.
 *
 * Taxonomy is deliberately not a consumer: `taxon_id` already *is* the taxonomy
 * resource's own id field, so remapping it there would filter the wrong column.
 * That is also why this is not `fieldMap`'s default — a resource has to opt in.
 */
export const taxonLineageFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
};

export interface StructuralFilterOptions {
  /**
   * Backend field name overrides, keyed by friendly filter name. A filter
   * name absent from this map falls back to `unknownFilters`.
   */
  fieldMap?: Readonly<Record<string, string>>;
  /**
   * How to resolve a filter name that has no entry in `fieldMap`:
   * - `"passthrough"` (default) — forward the filter name unchanged as the
   *   backend field. Every structural-filter module except Genome relies on
   *   this: their friendly filter names already are backend field names, so
   *   only a handful (like `taxon_id`) need remapping.
   * - `"drop"` — omit the filter instead of forwarding it. Genome uses this:
   *   its remap table is the total, authoritative list of filters it will
   *   ever send to the backend, so an unlisted name fails closed rather than
   *   reaching the backend under its raw (and possibly invalid) name.
   */
  unknownFilters?: "passthrough" | "drop";
}

/**
 * Compose a collection's friendly filters into Data API structural RQL:
 * values within one field are ORed, fields are ANDed, and an explicit
 * `state.rql` bypasses friendly filters entirely (returns `undefined`).
 *
 * Shared by every `*StructuralRql` domain wrapper except Feature's, whose
 * synthetic protein filter intentionally applies even when `state.rql` is
 * set (see `src/lib/feature-view/query.ts`).
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
    return predicates.length === 0
      ? []
      : [
          predicates.length === 1
            ? predicates[0]
            : `or(${predicates.join(",")})`,
        ];
  });
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

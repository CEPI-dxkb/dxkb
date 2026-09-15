import { eq, type DataResource } from "@/lib/data-api";

import type { CollectionState } from "./collection-state";

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

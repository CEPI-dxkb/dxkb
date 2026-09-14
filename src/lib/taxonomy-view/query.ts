import { taxonomyFields } from "@/constants/datafields/taxonomy";
import type { DataField } from "@/constants/datafields/types";
import { eq, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";

export const taxonomySorts = (Object.values(taxonomyFields) as DataField[])
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

export const taxonomyCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...taxonomySorts],
  friendlyFilters: ["taxon_id", "taxon_rank", "genetic_code", "division"],
};

export function parseTaxonomyCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, taxonomyCollectionOptions);
  if (state.rql) state.rql = validateRql("taxonomy", state.rql);
  return state;
}

export function taxonomyStructuralRql(
  state: CollectionState,
): string | undefined {
  if (state.rql) return undefined;
  const clauses = Object.entries(state.filters).flatMap(([field, values]) => {
    const predicates = values.map((value) => eq("taxonomy", field, value));
    return predicates.length === 1 ? predicates : [`or(${predicates.join(",")})`];
  });
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

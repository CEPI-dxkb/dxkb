import { taxonomyFields } from "@/constants/datafields/taxonomy";
import type { DataField } from "@/constants/datafields/types";
import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

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
  return structuralFilterRql("taxonomy", state);
}

import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { taxonomyMetadata } from "./fields";

export const taxonomySorts = taxonomyMetadata.sorts;

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

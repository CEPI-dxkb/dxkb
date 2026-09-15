import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { strainMetadata } from "./fields";

export const strainSorts = strainMetadata.sorts;

export const strainCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...strainSorts],
  friendlyFilters: ["taxon_id", "strain", ...strainMetadata.facetFields],
};

export function parseStrainCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, strainCollectionOptions);
  if (state.rql) state.rql = validateRql("strain", state.rql);
  return state;
}

const strainStructuralFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
};

export function strainStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("strain", state, {
    fieldMap: strainStructuralFieldMap,
  });
}

import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { proteinFeatureMetadata } from "./fields";

export const proteinFeatureSorts = proteinFeatureMetadata.sorts;

export const proteinFeatureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...proteinFeatureSorts],
  friendlyFilters: [
    "genome_id",
    "feature_id",
    ...proteinFeatureMetadata.facetFields,
  ],
  legacyRqlFilter: true,
};

export function parseProteinFeatureCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, proteinFeatureCollectionOptions);
  if (state.rql) state.rql = validateRql("protein_feature", state.rql);
  return state;
}

export function proteinFeatureStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("protein_feature", state);
}

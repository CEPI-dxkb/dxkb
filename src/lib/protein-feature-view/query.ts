import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import type { DataField } from "@/constants/datafields/types";
import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

const fields: DataField[] = Object.values(proteinFeatureFields);

export const proteinFeatureSorts = fields
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = fields
  .filter((field) => field.facet)
  .map((field) => field.field);

export const proteinFeatureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...proteinFeatureSorts],
  friendlyFilters: ["genome_id", "feature_id", ...facetFields],
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

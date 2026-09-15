import { epitopeFields } from "@/constants/datafields/epitope";
import type { DataField } from "@/constants/datafields/types";
import { eq, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

export const epitopeSorts = (Object.values(epitopeFields) as DataField[])
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = (Object.values(epitopeFields) as DataField[])
  .filter((field) => field.facet)
  .map((field) => field.field);

export const epitopeCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...epitopeSorts],
  friendlyFilters: ["taxon_id", ...facetFields],
};

export function parseEpitopeCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, epitopeCollectionOptions);
  if (state.rql) state.rql = validateRql("epitope", state.rql);
  return state;
}

const epitopeStructuralFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
};

export function epitopeStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("epitope", state, {
    fieldMap: epitopeStructuralFieldMap,
  });
}

export function epitopeAssayRql(epitopeId: string): string {
  return eq("epitope_assay", "epitope_id", epitopeId);
}

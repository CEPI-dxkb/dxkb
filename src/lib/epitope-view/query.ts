import { eq, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { epitopeMetadata } from "./fields";

export const epitopeSorts = epitopeMetadata.sorts;

export const epitopeCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...epitopeSorts],
  friendlyFilters: ["taxon_id", ...epitopeMetadata.facetFields],
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

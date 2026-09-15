import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { proteinStructureMetadata } from "./fields";

export const proteinStructureSorts = proteinStructureMetadata.sorts;

export const proteinStructureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...proteinStructureSorts],
  friendlyFilters: [
    "taxon_id",
    "genome_id",
    ...proteinStructureMetadata.facetFields,
  ],
};

export function parseProteinStructureCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, proteinStructureCollectionOptions);
  if (state.rql) state.rql = validateRql("protein_structure", state.rql);
  return state;
}

const proteinStructureStructuralFieldMap: Readonly<Record<string, string>> = {
  taxon_id: "taxon_lineage_ids",
};

export function proteinStructureStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("protein_structure", state, {
    fieldMap: proteinStructureStructuralFieldMap,
  });
}

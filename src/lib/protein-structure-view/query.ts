import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import type { DataField } from "@/constants/datafields/types";
import { resourceRegistry, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

const unsafeProjectionFields = new Set(["sequence", "alignments"]);
const fields: DataField[] = Object.values(proteinStructureFields);
const resourceFields = resourceRegistry.protein_structure.fields;

export const proteinStructureSorts = fields
  .filter(
    (field) =>
      !unsafeProjectionFields.has(field.field) &&
      field.show_in_table !== false &&
      resourceFields[field.field].sortable,
  )
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = fields
  .filter((field) => field.facet)
  .map((field) => field.field);

export const proteinStructureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...proteinStructureSorts],
  friendlyFilters: ["taxon_id", "genome_id", ...facetFields],
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

import { strainFields } from "@/constants/datafields/strain";
import type { DataField } from "@/constants/datafields/types";
import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

const fields: DataField[] = Object.values(strainFields);
const multipleFields = new Set([
  "taxon_lineage_ids",
  "taxon_lineage_names",
  "genome_ids",
  "genbank_accessions",
  "1_pb2",
  "2_pb1",
  "3_pa",
  "4_ha",
  "5_np",
  "6_na",
  "7_mp",
  "8_ns",
  "s",
  "m",
  "l",
  "other_segments",
]);

export const strainSorts = fields
  .filter(
    (field) =>
      field.show_in_table !== false &&
      field.sortable !== false &&
      !multipleFields.has(field.field),
  )
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = fields
  .filter((field) => field.facet)
  .map((field) => field.field);

export const strainCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...strainSorts],
  friendlyFilters: ["taxon_id", "strain", ...facetFields],
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

import { serologyFields } from "@/constants/datafields/serology";
import type { DataField } from "@/constants/datafields/types";
import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";

const fields: DataField[] = Object.values(serologyFields);

export const serologySorts = fields
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = fields
  .filter((field) => field.facet)
  .map((field) => field.field);

export const serologyCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...serologySorts],
  friendlyFilters: facetFields,
};

export function parseSerologyCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, serologyCollectionOptions);
  if (state.rql) state.rql = validateRql("serology", state.rql);
  return state;
}

export function serologyStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("serology", state);
}

import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { serologyMetadata } from "./fields";

export const serologySorts = serologyMetadata.sorts;

export const serologyCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...serologySorts],
  friendlyFilters: serologyMetadata.facetFields,
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

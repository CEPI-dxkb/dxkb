import { validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { structuralFilterRql } from "@/lib/views/structural-rql";
import { surveillanceMetadata } from "./fields";

export const surveillanceSorts = surveillanceMetadata.sorts;

export const surveillanceCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...surveillanceSorts],
  friendlyFilters: surveillanceMetadata.facetFields,
};

export function parseSurveillanceCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, surveillanceCollectionOptions);
  if (state.rql) state.rql = validateRql("surveillance", state.rql);
  return state;
}

export function surveillanceStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("surveillance", state);
}

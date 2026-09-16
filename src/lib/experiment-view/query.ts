import { eq, serializeRql, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { rqlKeyword, type SearchParamsRecord } from "@/lib/views/rql";
import {
  structuralFilterRql,
  taxonLineageFieldMap,
} from "@/lib/views/structural-rql";
import { experimentMetadata } from "./fields";

export const experimentSorts = experimentMetadata.sorts;

export const experimentCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...experimentSorts],
  friendlyFilters: ["taxon_id", ...experimentMetadata.facetFields],
};

export function parseExperimentCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, experimentCollectionOptions);
  if (state.rql) state.rql = validateRql("experiment", state.rql);
  return state;
}

export function experimentStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("experiment", state, {
    fieldMap: taxonLineageFieldMap,
  });
}

export function biosetStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralFilterRql("bioset", state);
}

export function experimentBiosetRql(experimentId: string): string {
  return eq("bioset", "exp_id", experimentId);
}

export function experimentCollectionScopeRql(
  state: CollectionState,
): string | undefined {
  const predicates = [
    experimentStructuralRql(state),
    state.refine?.trim() ? rqlKeyword(state.refine.trim()) : undefined,
    state.rql,
  ].filter((predicate): predicate is string => Boolean(predicate));
  if (predicates.length === 0) return undefined;
  return predicates.length === 1
    ? predicates[0]
    : `and(${predicates.join(",")})`;
}

export function experimentBiosetCollectionRql(experimentIds: string[]): string {
  return serializeRql("bioset", {
    operator: "in",
    field: "exp_id",
    values: experimentIds,
  });
}

export function genomeExperimentRql(genomeId: string): string {
  return eq("experiment", "genome_id", genomeId);
}

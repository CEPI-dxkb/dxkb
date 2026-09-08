import { experimentFields } from "@/constants/datafields/experiment";
import type { DataField } from "@/constants/datafields/types";
import {
  eq,
  serializeRql,
  validateRql,
  type DataResource,
} from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { rqlKeyword, type SearchParamsRecord } from "@/lib/views/rql";

export const experimentSorts = (Object.values(experimentFields) as DataField[])
  .filter((field) => field.show_in_table !== false && field.sortable !== false)
  .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]);

const facetFields = (Object.values(experimentFields) as DataField[])
  .filter((field) => field.facet)
  .map((field) => field.field);

export const experimentCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...experimentSorts],
  friendlyFilters: ["taxon_id", ...facetFields],
  filterFieldMap: { taxon_id: "taxon_lineage_ids" },
};

export function parseExperimentCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, experimentCollectionOptions);
  if (state.rql) state.rql = validateRql("experiment", state.rql);
  return state;
}

function structuralRql(
  state: CollectionState,
  resource: DataResource,
  fieldMap: Readonly<Record<string, string>> = {},
): string | undefined {
  if (state.rql) return undefined;
  const clauses = Object.entries(state.filters).flatMap(([field, selected]) => {
    const backendField = fieldMap[field] ?? field;
    const predicates = selected.map((value) => eq(resource, backendField, value));
    return predicates.length === 0
      ? []
      : [predicates.length === 1 ? predicates[0] : `or(${predicates.join(",")})`];
  });
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

export function experimentStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralRql(
    state,
    "experiment",
    experimentCollectionOptions.filterFieldMap,
  );
}

export function biosetStructuralRql(
  state: CollectionState,
): string | undefined {
  return structuralRql(state, "bioset");
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

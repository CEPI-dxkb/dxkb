import { eq, validateRql } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { proteinFeatureRql } from "@/lib/views/child-resources";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { featureMetadata } from "./fields";

export const featureSorts = featureMetadata.sorts;

export const recentGenomeFeatureRql =
  "and(eq(genome_id,*),genome(and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))))";

export function featureBaseRql(state: CollectionState): string | undefined {
  return state.rql ? undefined : recentGenomeFeatureRql;
}

export const featureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...featureSorts],
  friendlyFilters: ["genome_id", "annotation", "feature_type", "filter"],
  independentFilters: ["filter"],
};

export function parseFeatureCollectionState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseCollectionState(params, featureCollectionOptions);
  if (state.rql) state.rql = validateRql("genome_feature", state.rql);

  const rawFilter = Object.hasOwn(state.filters, "filter")
    ? state.filters.filter[0]
    : undefined;
  const filter = rawFilter?.replace(/^"|"$/g, "");
  if (filter && /^[A-Za-z0-9_. -]+$/.test(filter)) state.filters.filter = [filter];
  else delete state.filters.filter;
  return state;
}

export function featureStructuralRql(
  state: CollectionState,
): string | undefined {
  const clauses: string[] = [];
  if (!state.rql) {
    for (const name of ["genome_id", "annotation", "feature_type"] as const) {
      const selected = state.filters[name] ?? [];
      if (selected.length === 0) continue;
      const predicates = selected.map((value) => eq("genome_feature", name, value));
      clauses.push(
        predicates.length === 1 ? predicates[0] : `or(${predicates.join(",")})`,
      );
    }
  }

  const filter = Object.hasOwn(state.filters, "filter")
    ? state.filters.filter[0]
    : undefined;
  if (filter === "protein") {
    clauses.push(proteinFeatureRql);
  } else if (filter) {
    clauses.push(eq("genome_feature", "feature_type", filter));
  }

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

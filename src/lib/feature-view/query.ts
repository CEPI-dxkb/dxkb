import { eq, validateRql, type DataSort } from "@/lib/data-api";
import {
  parseCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { CollectionDownloadSpec } from "@/lib/data-api/downloads";
import {
  proteinDownloadSpec,
  proteinFeatureRql,
} from "@/lib/views/child-resources";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { featureMetadata } from "./fields";

export const featureSorts = featureMetadata.sorts;

export const featureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...featureSorts],
  friendlyFilters: ["genome_id", "annotation", "feature_type", "filter"],
  independentFilters: ["filter"],
};

/** Legacy FeatureGrid/ProteinGrid row order when no column is sorted; keyword searches keep the backend's relevance order. */
export const featureGridDefaultOrder: DataSort = {
  field: "genome_name",
  direction: "asc",
  then: [
    { field: "accession", direction: "asc" },
    { field: "start", direction: "asc" },
  ],
};

/** Legacy FeatureList's default filter, shown as a removable facet value; DXKB's Features tabs carry it too. */
export const featureListDefaultFilters = { annotation: ["PATRIC"] } as const;

/** The `/feature` URL schema: the shared one plus the PATRIC default, which stays beside an `rql` that picks no annotation. */
export const featureListCollectionOptions: CollectionStateOptions = {
  ...featureCollectionOptions,
  defaultFilters: featureListDefaultFilters,
};

export function parseFeatureCollectionState(
  params: SearchParamsRecord,
  options: CollectionStateOptions = featureCollectionOptions,
): CollectionState {
  const parsed = parseCollectionState(params, options);
  const state = parsed.rql
    ? parseCollectionState(
        { ...params, rql: validateRql("genome_feature", parsed.rql) },
        options,
      )
    : parsed;

  const rawFilter = Object.hasOwn(state.filters, "filter")
    ? state.filters.filter[0]
    : undefined;
  const filter = rawFilter?.replace(/^"|"$/g, "");
  if (filter && /^[A-Za-z0-9_. -]+$/.test(filter)) state.filters.filter = [filter];
  else delete state.filters.filter;
  return state;
}

function isProteinSearch(state: CollectionState): boolean {
  return (
    Object.hasOwn(state.filters, "filter") &&
    state.filters.filter[0] === "protein"
  );
}

export function featureDownloadSpec(
  state: CollectionState,
): CollectionDownloadSpec {
  return isProteinSearch(state) ? proteinDownloadSpec : {};
}

/** The Proteins search (`filter=protein`) gets the shared schema without the PATRIC default, since `proteinFeatureRql` already pins it. */
export function featureListOptionsFor(
  state: CollectionState,
): CollectionStateOptions {
  return isProteinSearch(state)
    ? featureCollectionOptions
    : featureListCollectionOptions;
}

export function parseFeatureListState(
  params: SearchParamsRecord,
): CollectionState {
  const state = parseFeatureCollectionState(
    params,
    featureListCollectionOptions,
  );
  const options = featureListOptionsFor(state);
  return options === featureListCollectionOptions
    ? state
    : parseFeatureCollectionState(params, options);
}

export function featureStructuralRql(
  state: CollectionState,
): string | undefined {
  const clauses: string[] = [];
  for (const name of ["genome_id", "annotation", "feature_type"] as const) {
    const selected = state.filters[name] ?? [];
    if (selected.length === 0) continue;
    const predicates = selected.map((value) => eq("genome_feature", name, value));
    clauses.push(
      predicates.length === 1 ? predicates[0] : `or(${predicates.join(",")})`,
    );
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

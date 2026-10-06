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

export const featureCollectionOptions: CollectionStateOptions = {
  defaultSort: "unsorted",
  sortAllowlist: ["unsorted", ...featureSorts],
  friendlyFilters: ["genome_id", "annotation", "feature_type", "filter"],
  independentFilters: ["filter"],
};

/**
 * Legacy BV-BRC FeatureList's grid default (`p3/layer/grids.js`:
 * `defaultFilter: "and(eq(annotation,%22PATRIC%22))"`), which it shows as a
 * selected, removable facet value. Legacy's Genome list, Genome page and
 * Taxonomy page Features tabs carry it too, and so do DXKB's.
 */
export const featureListDefaultFilters = { annotation: ["PATRIC"] } as const;

/**
 * The `/feature` list's URL schema: the shared one plus legacy's PATRIC default
 * (except for the Proteins search, `featureListOptionsFor`), which also stays
 * beside an explicit `rql` that does not pick an annotation, as legacy
 * FeatureList applies it to a link's query. The taxon Features tab uses it too.
 */
export const featureListCollectionOptions: CollectionStateOptions = {
  ...featureCollectionOptions,
  defaultFilters: featureListDefaultFilters,
};

export function parseFeatureCollectionState(
  params: SearchParamsRecord,
  options: CollectionStateOptions = featureCollectionOptions,
): CollectionState {
  const parsed = parseCollectionState(params, options);
  // Which filters stay beside the rql is read from the validated form, as the
  // query will send it (`filtersBesideRql`).
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

/**
 * The `/feature` list's URL schema for one parsed request. The Proteins search
 * (`filter=protein`: the Proteins search type and legacy ProteinList links)
 * gets the shared schema, without the PATRIC default: its `proteinFeatureRql`
 * already pins `eq(annotation,PATRIC)`, so removing a PATRIC chip there would
 * change nothing. Legacy ProteinList's removal (`#filter=false`) sends the
 * same query as well (2,122,451 rows for Dnak).
 */
export function featureListOptionsFor(
  state: CollectionState,
): CollectionStateOptions {
  return isProteinSearch(state)
    ? featureCollectionOptions
    : featureListCollectionOptions;
}

/** Parse a `/feature` list URL under its schema (`featureListOptionsFor`). */
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

/**
 * The Feature filters' clauses. Every filter the state holds applies: parsing
 * has already dropped the ones an explicit `rql` replaces, and kept beside it
 * the `/feature` list's PATRIC default unless that rql picks an annotation
 * (`filtersBesideRql`).
 */
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

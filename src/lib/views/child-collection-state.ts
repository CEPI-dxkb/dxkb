import { booleanFilterValues } from "@/lib/data-api/resources";
import {
  parseCollectionState,
  serializeCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "./collection-state";
import type { SearchParamsRecord } from "./rql";

/**
 * Each child's params carry a `<urlKey>.` prefix so they cannot collide with
 * the page's own. Only listed keys are recognized, so an unrelated dotted param
 * (`source.id=123`) survives a tab switch.
 * `browser` and `compare` are not tables but tab-owned state the same cleanup
 * must drop.
 */
export const childCollectionUrlKeys = [
  "amr",
  "assays",
  "biosets",
  "browser",
  "compare",
  "domains",
  "epitopes",
  "features",
  "interactions",
  "proteins",
  "sequences",
  "serology",
  "sfvt",
  "strains",
  "structures",
  "surveillance",
] as const;

export type ChildCollectionUrlKey = (typeof childCollectionUrlKeys)[number];

const childCollectionUrlKeySet: ReadonlySet<string> = new Set(
  childCollectionUrlKeys,
);

export function isChildCollectionParam(name: string): boolean {
  const dot = name.indexOf(".");
  return dot > 0 && childCollectionUrlKeySet.has(name.slice(0, dot));
}

export function withoutChildCollectionParams(
  params: SearchParamsRecord,
): SearchParamsRecord {
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !isChildCollectionParam(name)),
  );
}

export function deleteChildCollectionParams(params: URLSearchParams): void {
  for (const name of [...params.keys()]) {
    if (isChildCollectionParam(name)) params.delete(name);
  }
}

// An unvalidated `rql` from the URL would reach the data API, and nothing in
// the UI gives a child table structural RQL, so neither is accepted.
const urlOnlyParamNames = new Set(["rql", "refine"]);

/**
 * `rql` and `refine` are dropped before parsing, so a stray `features.rql`
 * never reaches the parsed state or, unvalidated, the Data API.
 */
function ownParams(
  params: SearchParamsRecord,
  urlKey: ChildCollectionUrlKey,
): SearchParamsRecord {
  const prefix = `${urlKey}.`;
  return Object.fromEntries(
    Object.entries(params)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.slice(prefix.length), value] as const)
      .filter(([name]) => !urlOnlyParamNames.has(name)),
  );
}

function withoutUrlOnlyFields(state: CollectionState): CollectionState {
  return { ...state, rql: undefined, refine: undefined };
}

export function parseChildCollectionState(
  params: SearchParamsRecord,
  urlKey: ChildCollectionUrlKey,
  options: CollectionStateOptions,
): CollectionState {
  return parseCollectionState(ownParams(params, urlKey), options);
}

export function replaceChildCollectionSearchParams(
  params: SearchParamsRecord,
  urlKey: ChildCollectionUrlKey,
  next: CollectionState,
  options: CollectionStateOptions,
): URLSearchParams {
  const prefix = `${urlKey}.`;
  const result = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name.startsWith(prefix) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      result.append(name, item);
    }
  }
  serializeCollectionState(withoutUrlOnlyFields(next), options).forEach(
    (value, name) => {
      result.append(`${prefix}${name}`, value);
    },
  );
  return result;
}

/**
 * `extraFilters` are URL filters that are not facets (the Interactions
 * `interactor` focus): they parse and serialize like a facet's, but `filterValues`
 * stays facet-only and nothing counts them. The Table and any other writer of the
 * same `<urlKey>.` params build their options from one expression, or a write by
 * one drops the other's param.
 */
export function childCollectionOptions(
  columns: readonly { id: string; sortable?: boolean }[],
  facets: readonly { field: string }[] | undefined,
  defaultSort: string,
  defaultFilters?: CollectionStateOptions["defaultFilters"],
  extraFilters: readonly string[] = [],
): CollectionStateOptions {
  const sortable = columns
    .filter((column) => column.sortable !== false)
    .map((column) => column.id);
  return {
    defaultSort,
    sortAllowlist: [
      ...new Set([
        defaultSort,
        "unsorted",
        ...sortable.flatMap((id) => [`${id}:asc`, `${id}:desc`]),
      ]),
    ],
    friendlyFilters: [
      ...(facets?.map((facet) => facet.field) ?? []),
      ...extraFilters,
    ],
    filterValues: booleanFilterValues(facets?.map((facet) => facet.field) ?? []),
    defaultFilters,
  };
}

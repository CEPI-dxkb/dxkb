import {
  parseCollectionState,
  serializeCollectionState,
  type CollectionState,
  type CollectionStateOptions,
} from "./collection-state";
import type { SearchParamsRecord } from "./rql";

/**
 * URL state for a collection nested inside a page that already owns the top-level
 * collection params. Each child's params carry a `<urlKey>.` prefix
 * (`?tab=features&features.page=2`), so they can never collide with the page's own.
 *
 * Every `urlKey` is listed here, and `ResourceChildCollection` accepts only these,
 * so cleanup recognizes child state by a known prefix rather than by any dot: an
 * unrelated dotted param (`source.id=123`) survives a tab switch or a parent
 * collection write like every other param those navigations do not own. A new
 * nested table adds its key to this list.
 */
export const childCollectionUrlKeys = [
  "assays",
  "biosets",
  "domains",
  "features",
  "interactions",
  "proteins",
  "sequences",
  "sfvt",
  "structures",
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

/**
 * The in-place form of `withoutChildCollectionParams`, for a caller that already
 * holds the `URLSearchParams` it is about to navigate with (a tab or view switch,
 * where a page number from one tab must not land on another).
 */
export function deleteChildCollectionParams(params: URLSearchParams): void {
  for (const name of [...params.keys()]) {
    if (isChildCollectionParam(name)) params.delete(name);
  }
}

// Nothing in the UI gives a child table structural RQL or a refine term, and an
// unvalidated `rql` from the URL would reach the data API, so neither is accepted.
const urlOnlyParamNames = new Set(["rql", "refine"]);

/**
 * This table's own params, prefix stripped. `rql` and `refine` are dropped here,
 * before parsing, not from the parsed state: an explicit `rql` makes
 * `parseCollectionState` skip the friendly filters, so a stray `features.rql`
 * would otherwise still erase `features.feature_type`.
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

/** What a child table may carry in the URL, derived from what its profile can do. */
export function childCollectionOptions(
  columns: readonly { id: string; sortable?: boolean }[],
  facets: readonly { field: string }[] | undefined,
  defaultSort: string,
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
    friendlyFilters: facets?.map((facet) => facet.field) ?? [],
  };
}

import { rqlAnd, rqlEq, type SearchParamsRecord } from "./rql";

export interface CollectionStateOptions<Sort extends string = string> {
  defaultSort: Sort;
  sortAllowlist: readonly Sort[];
  friendlyFilters?: readonly string[];
  /** Filters that remain active and serialized alongside explicit structural RQL. */
  independentFilters?: readonly string[];
  filterFieldMap?: Readonly<Record<string, string>>;
  /** Accept legacy `filter=<RQL>` URLs and canonicalize them to `rql`. */
  legacyRqlFilter?: boolean;
}

export interface CollectionState<Sort extends string = string> {
  keyword?: string;
  refine?: string;
  rql?: string;
  filters: Record<string, string[]>;
  page: number;
  sort: Sort;
}

export interface CollectionStateUpdate<Sort extends string = string> {
  keyword?: string | null;
  refine?: string | null;
  rql?: string | null;
  filters?: Readonly<Record<string, readonly string[] | null | undefined>>;
  page?: number;
  sort?: Sort;
}

/**
 * Convert a `field:direction` collection sort into the data-API sort argument.
 * `"unsorted"` means "let the endpoint decide", so it maps to undefined.
 */
export function dataSort(
  sort: string,
): { field: string; direction: "asc" | "desc" } | undefined {
  if (sort === "unsorted") return undefined;
  const [field, direction] = sort.split(":");
  return { field, direction: direction === "desc" ? "desc" : "asc" };
}

const managedParams = new Set(["keyword", "refine", "rql", "page", "sort"]);

function optionalValue(
  params: SearchParamsRecord,
  name: string,
  rejectRepeated = false,
): string | undefined {
  const value = params[name];
  if (Array.isArray(value)) {
    if (rejectRepeated && value.length > 1) return undefined;
    return value[0] || undefined;
  }
  return value || undefined;
}

function values(params: SearchParamsRecord, name: string): string[] {
  const value = params[name];
  return [
    ...new Set(
      (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean),
    ),
  ];
}

function parsePage(params: SearchParamsRecord): number {
  const rawPage = optionalValue(params, "page", true);
  if (rawPage === undefined) return 1;
  if (!/^[1-9]\d*$/.test(rawPage)) return 1;
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page)) return 1;
  return page;
}

function parseSort<Sort extends string>(
  sort: string,
  options: CollectionStateOptions<Sort>,
): Sort {
  return options.sortAllowlist.includes(sort as Sort)
    ? (sort as Sort)
    : options.defaultSort;
}

export function consumesLegacyRqlFilter<Sort extends string>(
  params: SearchParamsRecord,
  options: CollectionStateOptions<Sort>,
): boolean {
  if (!options.legacyRqlFilter || optionalValue(params, "rql") !== undefined) {
    return false;
  }
  return optionalValue(params, "filter")?.includes("(") === true;
}

/** Parse and validate the URL-owned portion of collection state. */
export function parseCollectionState<Sort extends string>(
  params: SearchParamsRecord,
  options: CollectionStateOptions<Sort>,
): CollectionState<Sort> {
  const keyword = optionalValue(params, "keyword");
  const refine = optionalValue(params, "refine");
  const canonicalRql = optionalValue(params, "rql");
  const rql = consumesLegacyRqlFilter(params, options)
    ? optionalValue(params, "filter")
    : canonicalRql;
  const rawSort = optionalValue(params, "sort", true);
  const sort = parseSort(rawSort ?? options.defaultSort, options);
  const filters: Record<string, string[]> = {};

  // An explicit structural expression is authoritative. Keyword is deliberately
  // independent and may still be combined with it by the collection query.
  const independentFilters = new Set(options.independentFilters);
  for (const name of options.friendlyFilters ?? []) {
    if (rql !== undefined && !independentFilters.has(name)) continue;
    const selected = values(params, name);
    if (selected.length > 0) filters[name] = selected;
  }

  return { keyword, refine, rql, filters, page: parsePage(params), sort };
}

/** Validate a programmatic state and remove values omitted by the URL schema. */
export function canonicalizeCollectionState<Sort extends string>(
  state: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): CollectionState<Sort> {
  if (!Number.isSafeInteger(state.page) || state.page < 1) {
    throw new Error(`Invalid collection page: ${String(state.page)}`);
  }
  if (!options.sortAllowlist.includes(state.sort)) {
    throw new Error(`Invalid collection sort: ${state.sort}`);
  }
  const sort = state.sort;
  const keyword = state.keyword || undefined;
  const refine = state.refine || undefined;
  const rql = state.rql || undefined;
  const filters: Record<string, string[]> = {};
  const independentFilters = new Set(options.independentFilters);

  for (const name of options.friendlyFilters ?? []) {
    if (rql !== undefined && !independentFilters.has(name)) continue;
    const selected = [...new Set(state.filters[name] ?? [])].filter(Boolean);
    if (selected.length > 0) filters[name] = selected;
  }

  return { keyword, refine, rql, filters, page: state.page, sort };
}

/** Serialize only canonical collection parameters in stable schema order. */
export function serializeCollectionState<Sort extends string>(
  state: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  const canonical = canonicalizeCollectionState(state, options);
  const params = new URLSearchParams();
  if (canonical.keyword !== undefined) params.set("keyword", canonical.keyword);
  if (canonical.refine !== undefined) params.set("refine", canonical.refine);
  if (canonical.rql !== undefined) params.set("rql", canonical.rql);
  for (const [name, selected] of Object.entries(canonical.filters)) {
    for (const value of selected) params.append(name, value);
  }
  if (canonical.page !== 1) params.set("page", String(canonical.page));
  if (canonical.sort !== options.defaultSort)
    params.set("sort", canonical.sort);
  return params;
}

/** Resolve structural filters to backend RQL without folding in keyword search. */
export function collectionStateToRql<Sort extends string>(
  state: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): string {
  const canonical = canonicalizeCollectionState(state, options);
  if (canonical.rql !== undefined) return canonical.rql;
  const clauses = Object.entries(canonical.filters).map(([name, selected]) => {
    const field = options.filterFieldMap?.[name] ?? name;
    const predicates = selected.map((value) => rqlEq(field, value));
    return predicates.length === 1
      ? predicates[0]
      : `or(${predicates.join(",")})`;
  });
  return clauses.length === 0 ? "" : rqlAnd(...clauses);
}

/** Canonicalize managed parameters while retaining unrelated URL state. */
export function canonicalizeCollectionSearchParams<Sort extends string>(
  params: SearchParamsRecord,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  return mergeWithUnrelatedParams(
    params,
    serializeCollectionState(parseCollectionState(params, options), options),
    options,
  );
}

/** Apply a collection-state update, resetting pagination when query shape changes. */
export function updateCollectionSearchParams<Sort extends string>(
  params: SearchParamsRecord,
  update: CollectionStateUpdate<Sort>,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  const current = parseCollectionState(params, options);
  const filterUpdates = update.filters ?? {};
  const filters = Object.fromEntries(
    [...Object.keys(current.filters), ...Object.keys(filterUpdates)].flatMap(
      (name) => {
        const value =
          name in filterUpdates ? filterUpdates[name] : current.filters[name];
        return value?.length ? [[name, [...value]]] : [];
      },
    ),
  );
  const next: CollectionState<Sort> = {
    ...current,
    keyword:
      update.keyword === null ? undefined : (update.keyword ?? current.keyword),
    refine:
      update.refine === null ? undefined : (update.refine ?? current.refine),
    rql: update.rql === null ? undefined : (update.rql ?? current.rql),
    filters,
    page: update.page ?? current.page,
    sort: update.sort ?? current.sort,
  };
  const canonicalNext = canonicalizeCollectionState(next, options);
  const queryChanged =
    current.keyword !== canonicalNext.keyword ||
    current.refine !== canonicalNext.refine ||
    current.rql !== canonicalNext.rql ||
    current.sort !== canonicalNext.sort ||
    !sameFilters(current.filters, canonicalNext.filters);
  if (queryChanged) canonicalNext.page = 1;

  return mergeWithUnrelatedParams(
    params,
    serializeCollectionState(canonicalNext, options),
    options,
  );
}

function sameFilters(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): boolean {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([name, value]) => {
      if (!Object.hasOwn(right, name)) return false;
      const other = right[name];
      return (
        value.length === other.length &&
        value.every((item, index) => other[index] === item)
      );
    })
  );
}

function mergeWithUnrelatedParams<Sort extends string>(
  source: SearchParamsRecord,
  collectionParams: URLSearchParams,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  const result = new URLSearchParams();
  const managed = new Set([
    ...managedParams,
    ...(options.friendlyFilters ?? []),
    ...(consumesLegacyRqlFilter(source, options) ? ["filter"] : []),
  ]);
  for (const [name, value] of Object.entries(source)) {
    if (managed.has(name) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value])
      result.append(name, item);
  }
  collectionParams.forEach((value, name) => {
    result.append(name, value);
  });
  return result;
}

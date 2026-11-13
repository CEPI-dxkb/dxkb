import type { SearchParamsRecord } from "./rql";

export interface CollectionStateOptions<Sort extends string = string> {
  defaultSort: Sort;
  sortAllowlist: readonly Sort[];
  friendlyFilters?: readonly string[];
  independentFilters?: readonly string[];
  filterValues?: Readonly<Record<string, readonly string[]>>;
  /**
   * Every key must also be a `friendlyFilters` entry. A default is omitted from
   * URLs; once removed, the URL carries `<name>=*` so the removal survives
   * reload.
   * Beside an explicit `rql` that names a default's field the default is not
   * applied implicitly (`defaultShadowed`); an explicit value for that field
   * still ANDs with the rql like any other filter (`filtersBesideRql`).
   */
  defaultFilters?: Readonly<Record<string, readonly string[]>>;
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

/**
 * A friendly filter's values from the URL. The empty string is kept: it is a
 * facet's "(empty)" bucket (`host=`), which the Data API selects with
 * `eq(host,"")`.
 */
function values(params: SearchParamsRecord, name: string): string[] {
  const value = params[name];
  return [
    ...new Set(Array.isArray(value) ? value : value === undefined ? [] : [value]),
  ];
}

function allowedValues<Sort extends string>(
  name: string,
  selected: readonly string[],
  options: CollectionStateOptions<Sort>,
): string[] {
  const allowed =
    options.filterValues && Object.hasOwn(options.filterValues, name)
      ? options.filterValues[name]
      : undefined;
  return allowed
    ? selected.filter((value) => allowed.includes(value))
    : [...selected];
}

export const clearedFilterValue = "*";

function defaultFilterValues<Sort extends string>(
  name: string,
  options: CollectionStateOptions<Sort>,
): readonly string[] | undefined {
  return options.defaultFilters && Object.hasOwn(options.defaultFilters, name)
    ? options.defaultFilters[name]
    : undefined;
}

/**
 * A value at the start of an `in(...)` list is not an operator's argument. Read
 * the validated rql where there is one: values there cannot hold a literal `(`.
 */
export function rqlNamesField(rql: string, field: string): boolean {
  return new RegExp(`[a-z]\\(\\s*${field}\\s*,`).test(rql);
}

/**
 * An rql that names a default's field (Feature's `eq(annotation,RefSeq)`) keeps
 * the default from applying implicitly, since ANDing it with the rql's own
 * choice could empty the list. Only the implicit default is held back: an
 * explicit value is the user's and still applies, and so is written to the URL
 * even when it equals the default. An independent filter's default always
 * applies.
 */
function defaultShadowed<Sort extends string>(
  name: string,
  rql: string | undefined,
  options: CollectionStateOptions<Sort>,
): boolean {
  return (
    rql !== undefined &&
    defaultFilterValues(name, options) !== undefined &&
    !(options.independentFilters ?? []).includes(name) &&
    rqlNamesField(rql, name)
  );
}

/** The default a filter falls back to without an explicit value, if any. */
function implicitDefault<Sort extends string>(
  name: string,
  rql: string | undefined,
  options: CollectionStateOptions<Sort>,
): readonly string[] | undefined {
  return defaultShadowed(name, rql, options)
    ? undefined
    : defaultFilterValues(name, options);
}

function selectedFilterValues<Sort extends string>(
  name: string,
  requested: readonly string[],
  rql: string | undefined,
  options: CollectionStateOptions<Sort>,
): string[] {
  if (!defaultFilterValues(name, options)) {
    return allowedValues(name, requested, options);
  }
  const selected = allowedValues(
    name,
    requested.filter((value) => value !== clearedFilterValue),
    options,
  );
  if (selected.length > 0) return selected;
  const fallback = implicitDefault(name, rql, options);
  return !fallback || requested.includes(clearedFilterValue) ? [] : [...fallback];
}

/**
 * Every friendly filter, a default's included, stays beside an explicit `rql`,
 * so a facet pick ANDs with the query and narrows it instead of replacing it.
 * The rql changes only whether a default applies implicitly
 * (`defaultShadowed`). Clear all still removes the rql and every filter.
 */
export function filtersBesideRql<Sort extends string>(
  _rql: string | undefined,
  options: CollectionStateOptions<Sort>,
): Set<string> {
  return new Set(options.friendlyFilters ?? []);
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
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

function consumesLegacyRqlFilter<Sort extends string>(
  params: SearchParamsRecord,
  options: CollectionStateOptions<Sort>,
): boolean {
  if (!options.legacyRqlFilter || optionalValue(params, "rql") !== undefined) {
    return false;
  }
  return optionalValue(params, "filter")?.includes("(") === true;
}

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

  // Keyword and friendly filters both AND with an explicit structural
  // expression.
  for (const name of options.friendlyFilters ?? []) {
    const selected = selectedFilterValues(
      name,
      values(params, name),
      rql,
      options,
    );
    if (selected.length > 0) filters[name] = selected;
  }

  return { keyword, refine, rql, filters, page: parsePage(params), sort };
}

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

  for (const name of options.friendlyFilters ?? []) {
    // "" stays: it is the "(empty)" bucket (see `values`).
    const selected = allowedValues(
      name,
      [...new Set(state.filters[name] ?? [])],
      options,
    );
    if (selected.length > 0) filters[name] = selected;
  }

  return { keyword, refine, rql, filters, page: state.page, sort };
}

export function serializeCollectionState<Sort extends string>(
  state: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  const canonical = canonicalizeCollectionState(state, options);
  const params = new URLSearchParams();
  if (canonical.keyword !== undefined) params.set("keyword", canonical.keyword);
  if (canonical.refine !== undefined) params.set("refine", canonical.refine);
  if (canonical.rql !== undefined) params.set("rql", canonical.rql);
  for (const name of options.friendlyFilters ?? []) {
    const selected = canonical.filters[name] ?? [];
    const fallback = implicitDefault(name, canonical.rql, options);
    // A default is implicit; a removed one is written so it survives reload.
    // An rql naming the default's field leaves no implicit default
    // (`implicitDefault`), so the values are written as they are.
    if (fallback && sameValues(selected, fallback)) continue;
    if (fallback && selected.length === 0) {
      params.append(name, clearedFilterValue);
      continue;
    }
    for (const value of selected) params.append(name, value);
  }
  if (canonical.page !== 1) params.set("page", String(canonical.page));
  if (canonical.sort !== options.defaultSort)
    params.set("sort", canonical.sort);
  return params;
}

/**
 * While an rql names a default's field the default is not applied implicitly
 * (`defaultShadowed`), so a change that moves the rql across that line has to
 * move the default with it, in both directions:
 *
 * - The rql starts naming the field: a stored value equal to the default was
 *   the implicit one (the previous state did not shadow it), so it is dropped.
 *   Left in, it would be written beside the rql as an explicit pick and AND
 *   with the rql's own choice (`eq(annotation,RefSeq)` and `annotation=PATRIC`
 *   match nothing).
 * - The rql stops naming it: the default is restored, since without this the
 *   next state could not tell "never applied" from "removed" and would
 *   serialize the cleared marker.
 *
 * A value the change itself set, a stored value that differs from the default,
 * and any value beside an rql that already named the field (an explicit pick)
 * are left alone. A full-state replacement skips this, since only the caller
 * knows whether the change meant to remove everything.
 */
export function withUnshadowedDefaults<Sort extends string>(
  previousRql: string | undefined,
  next: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
  explicit: ReadonlySet<string> = new Set(),
): CollectionState<Sort> {
  if (!options.defaultFilters) return next;
  const nextRql = next.rql || undefined;
  let filters = next.filters;
  for (const [name, fallback] of Object.entries(options.defaultFilters)) {
    if (explicit.has(name)) continue;
    const wasShadowed = defaultShadowed(name, previousRql, options);
    if (defaultShadowed(name, nextRql, options)) {
      if (!wasShadowed && sameValues(filters[name] ?? [], fallback)) {
        filters = Object.fromEntries(
          Object.entries(filters).filter(([key]) => key !== name),
        );
      }
      continue;
    }
    if (!wasShadowed) continue;
    if (Object.hasOwn(filters, name) && filters[name].length > 0) continue;
    filters = { ...filters, [name]: [...fallback] };
  }
  return filters === next.filters ? next : { ...next, filters };
}

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

/**
 * Never resets pagination: the caller supplies the complete next state. Kept
 * separate from `updateCollectionSearchParams` so the pagination-reset and
 * replacement rules stay distinct.
 */
export function replaceCollectionSearchParams<Sort extends string>(
  params: SearchParamsRecord,
  next: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  return mergeWithUnrelatedParams(
    params,
    serializeCollectionState(next, options),
    options,
  );
}

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
  const canonicalNext = canonicalizeCollectionState(
    withUnshadowedDefaults(
      current.rql,
      next,
      options,
      new Set(Object.keys(filterUpdates)),
    ),
    options,
  );
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

/**
 * While the filters are exactly the view's defaults they are left out, so a
 * default's own facet still counts the values it hides (legacy's annotation
 * facet shows RefSeq beside PATRIC). Beside an rql that names a default's field
 * a value equal to the default is the user's pick, not the default, so it
 * stays in the counts as it does in the list.
 * Independent filters are a scope the view keeps, so they neither touch the
 * defaults nor drop out of the counts.
 */
export function facetCountState<Sort extends string>(
  state: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
): CollectionState<Sort> {
  const defaults = Object.entries(options.defaultFilters ?? {});
  if (defaults.length === 0) return state;
  const independentFilters = new Set(options.independentFilters);
  const shown = Object.entries(state.filters).filter(
    ([name]) => !independentFilters.has(name),
  );
  const rql = state.rql || undefined;
  const untouched =
    shown.length === defaults.length &&
    defaults.every(
      ([name, selected]) =>
        !defaultShadowed(name, rql, options) &&
        sameValues(state.filters[name] ?? [], selected),
    );
  if (!untouched) return state;
  return {
    ...state,
    filters: Object.fromEntries(
      Object.entries(state.filters).filter(([name]) =>
        independentFilters.has(name),
      ),
    ),
  };
}

/**
 * The sole definition of "managed" for a view; `filter` is included only when
 * `params` is consuming a legacy `filter=<rql>` URL.
 */
export function collectionManagedParamNames<Sort extends string>(
  params: SearchParamsRecord,
  options: CollectionStateOptions<Sort>,
): Set<string> {
  return new Set([
    ...managedParams,
    ...(options.friendlyFilters ?? []),
    ...(consumesLegacyRqlFilter(params, options) ? ["filter"] : []),
  ]);
}

/**
 * For surfaces where several views' URL state can coexist (an organism landing
 * page's tabs): cleared together so stale state cannot survive a navigation or
 * reactivate in a view that recognizes the same key.
 */
export function unionCollectionManagedParamNames(
  params: SearchParamsRecord,
  optionsList: readonly CollectionStateOptions[],
): Set<string> {
  const union = new Set<string>();
  for (const options of optionsList) {
    for (const name of collectionManagedParamNames(params, options)) {
      union.add(name);
    }
  }
  return union;
}

export function toSearchParamsRecord(
  params: URLSearchParams,
): SearchParamsRecord {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => {
      const selected = params.getAll(key);
      return [key, selected.length === 1 ? selected[0] : selected];
    }),
  );
}

function mergeWithUnrelatedParams<Sort extends string>(
  source: SearchParamsRecord,
  collectionParams: URLSearchParams,
  options: CollectionStateOptions<Sort>,
): URLSearchParams {
  const result = new URLSearchParams();
  const managed = collectionManagedParamNames(source, options);
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

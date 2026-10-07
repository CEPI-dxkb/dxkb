import type { SearchParamsRecord } from "./rql";

export interface CollectionStateOptions<Sort extends string = string> {
  defaultSort: Sort;
  sortAllowlist: readonly Sort[];
  friendlyFilters?: readonly string[];
  /** Filters that remain active and serialized alongside explicit structural RQL. */
  independentFilters?: readonly string[];
  /**
   * Closed value sets for friendly filters, such as `true`/`false` for a
   * boolean field. Values outside the set are dropped wherever state is parsed
   * or canonicalized, so they never reach the backend, which rejects them.
   */
  filterValues?: Readonly<Record<string, readonly string[]>>;
  /**
   * Filters a view selects while its URL does not name them: legacy BV-BRC's
   * removable grid defaults, such as the Feature list's `annotation=PATRIC`.
   * Every key must also be a `friendlyFilters` entry. A default is omitted from
   * serialized URLs; once the user removes it, the URL carries `<name>=*`
   * (`clearedFilterValue`), so the removal survives reload and sharing. A
   * default stays beside an explicit `rql`, as legacy's does beside a link's
   * query, unless that rql names the default's field (`filtersBesideRql`), so
   * the view's structural RQL builder must apply it under an rql too (as
   * `featureStructuralRql` does; `structuralFilterRql` does not).
   */
  defaultFilters?: Readonly<Record<string, readonly string[]>>;
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

/** The URL value recording that the user removed a filter's default: `?annotation=*`. */
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
 * What a URL selects for one friendly filter. A filter with a default selects
 * it while the URL names no usable value for the filter, and nothing once the
 * URL holds only the cleared marker; values beside the marker win.
 */
function selectedFilterValues<Sort extends string>(
  name: string,
  requested: readonly string[],
  options: CollectionStateOptions<Sort>,
): string[] {
  const fallback = defaultFilterValues(name, options);
  if (!fallback) return allowedValues(name, requested, options);
  const selected = allowedValues(
    name,
    requested.filter((value) => value !== clearedFilterValue),
    options,
  );
  if (selected.length > 0) return selected;
  return requested.includes(clearedFilterValue) ? [] : [...fallback];
}

/**
 * Whether an explicit `rql` filters on `field`: some operator's first argument
 * is it (`eq(annotation,RefSeq)`, `in(annotation,(…))`), spaces allowed as the
 * RQL parser allows them. A value at the start of an `in(...)` list is not an
 * operator's argument. Read the validated rql where there is one: there a
 * value cannot hold a literal `(` (values come percent-encoded, `%28`).
 */
export function rqlNamesField(rql: string, field: string): boolean {
  return new RegExp(`[a-z]\\(\\s*${field}\\s*,`).test(rql);
}

/**
 * The friendly filters that stay active beside an explicit `rql`: the
 * independent ones, and each default whose field the rql does not name (an rql
 * that picks its own annotation replaces the PATRIC default). Without an rql,
 * every friendly filter applies.
 */
export function filtersBesideRql<Sort extends string>(
  rql: string | undefined,
  options: CollectionStateOptions<Sort>,
): Set<string> {
  const friendly = options.friendlyFilters ?? [];
  if (rql === undefined) return new Set(friendly);
  const independent = new Set(options.independentFilters);
  return new Set(
    friendly.filter(
      (name) =>
        independent.has(name) ||
        (defaultFilterValues(name, options) !== undefined &&
          !rqlNamesField(rql, name)),
    ),
  );
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

  // An explicit structural expression is authoritative over the filters it does
  // not keep (`filtersBesideRql`). Keyword is deliberately independent and may
  // still be combined with it by the collection query.
  const applied = filtersBesideRql(rql, options);
  for (const name of options.friendlyFilters ?? []) {
    if (!applied.has(name)) continue;
    const selected = selectedFilterValues(name, values(params, name), options);
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
  const applied = filtersBesideRql(rql, options);

  for (const name of options.friendlyFilters ?? []) {
    if (!applied.has(name)) continue;
    const selected = allowedValues(
      name,
      [...new Set(state.filters[name] ?? [])].filter(Boolean),
      options,
    );
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
  const applied = filtersBesideRql(canonical.rql, options);
  for (const name of options.friendlyFilters ?? []) {
    if (!applied.has(name)) continue;
    const selected = canonical.filters[name] ?? [];
    const fallback = defaultFilterValues(name, options);
    // A default is implicit; a removed one is written so it survives reload.
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
 * Restore the defaults an outgoing rql hid. While an rql names a default's
 * field the default drops out of the parsed filters, so a next state that no
 * longer has that rql cannot tell "hidden" from "removed" and would otherwise
 * serialize the cleared marker. A default the next state still leaves
 * shadowed, or that `explicit` names (a removal or pick in this same change),
 * is left as the caller set it. Only the caller knows whether a change meant
 * to remove everything ("Clear All Filters"), so a full-state replacement does
 * not apply this; a caller replacing the rql through a facet pick does.
 */
export function withUnshadowedDefaults<Sort extends string>(
  previousRql: string | undefined,
  next: CollectionState<Sort>,
  options: CollectionStateOptions<Sort>,
  explicit: ReadonlySet<string> = new Set(),
): CollectionState<Sort> {
  if (previousRql === undefined || !options.defaultFilters) return next;
  const before = filtersBesideRql(previousRql, options);
  const after = filtersBesideRql(next.rql || undefined, options);
  let filters = next.filters;
  for (const [name, fallback] of Object.entries(options.defaultFilters)) {
    if (before.has(name) || !after.has(name) || explicit.has(name)) continue;
    if (Object.hasOwn(filters, name) && filters[name].length > 0) continue;
    filters = { ...filters, [name]: [...fallback] };
  }
  return filters === next.filters ? next : { ...next, filters };
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

/**
 * Replace the URL-owned collection state wholesale, preserving unrelated
 * parameters. Unlike `updateCollectionSearchParams`, this never resets
 * pagination: the caller supplies the complete next state (including
 * `page`), so there is no incremental "did the query shape change" question
 * to answer. Keeping replacement and incremental update as separate
 * functions is deliberate — folding them into one behind a flag is how the
 * pagination-reset rule and the replacement rule got confused with each
 * other before.
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
 * The state a view's facet counts are read for. While the filters are exactly
 * the view's defaults (the user has not touched them), the defaults are left
 * out, so a default's own facet still counts the values it hides: legacy
 * FeatureList's annotation facet shows RefSeq beside its PATRIC default. Once
 * the user picks or removes anything, the counts use the filters as shown, as
 * legacy's do. Independent filters are a scope the view keeps beside any other
 * state (the Proteins search's `filter=protein`), not something the user picks,
 * so they neither touch the defaults nor drop out of the counts.
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
  const untouched =
    shown.length === defaults.length &&
    defaults.every(([name, selected]) =>
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
 * Parameter names a single collection view owns and may clear: the fixed
 * managed keys, this view's own friendly filters, and — only when `params`
 * is currently consuming a legacy `filter=<rql>` URL under these options —
 * `filter` itself. This is the sole definition of "managed" for a view; both
 * canonicalization/incremental-update and full-state replacement go through
 * it via `mergeWithUnrelatedParams`.
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
 * Union of managed parameter names across several collection views' options,
 * each evaluated against the same source params. For a surface where more
 * than one view's URL state can coexist (e.g. an organism landing page's
 * tabs), this is the set of parameters that must be cleared together so
 * stale state from any participating view cannot survive a navigation that
 * doesn't belong to it — and can't silently reactivate if the destination
 * view happens to recognize the same key.
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

/** Convert a `URLSearchParams` into the record shape the parsers expect,
 * collapsing single-value entries and preserving repeats as arrays. */
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

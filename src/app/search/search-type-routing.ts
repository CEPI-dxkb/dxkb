import {
  searchDescriptors,
  type SearchRoute,
  type SearchType,
} from "@/constants/search-info";
import { taxonomyCollectionOptions } from "@/lib/taxonomy-view/query";
import {
  collectionManagedParamNames,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";

type CanonicalSearchRoute = Extract<SearchRoute, { status: "canonical" }>;

/** Read a single value out of a possibly-repeated search parameter. */
export function firstSearchParamValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Where a legacy `/search?type=…` request resolves. Every branch is explicit:
 * a request that reaches `unsupported` did not fall through a dispatch table,
 * it named a type this app has no view for.
 */
export type LegacySearchTarget =
  /**
   * Move to a canonical collection route. `page.tsx` serves it with Next's
   * `redirect()` (307), not `permanentRedirect()` (308) — the same status the
   * Taxa and Experiment redirects have always used.
   */
  | { kind: "redirect"; href: string }
  /** The all-data-types result page (legacy `type=everything`, and Overview). */
  | { kind: "allTypes" }
  /** The surviving legacy list UI, for types with no canonical view yet. */
  | { kind: "typeSearch"; searchtype: string }
  /** Overview with nothing to search for. */
  | { kind: "prompt" }
  /** A named type with no destination in this app. */
  | { kind: "unsupported"; searchtype: string };

/**
 * `type=bioset` was never a data type of its own — it is the Biosets tab of the
 * Experiment view, so it resolves through the Experiment descriptor.
 */
const legacyTypeAliases: Readonly<Record<string, string | undefined>> = {
  bioset: "experiment",
};

/**
 * Parameters the legacy `/search` route owns, so neither is carried verbatim:
 * `type` is the dispatch discriminator and means nothing downstream, and `q`
 * becomes `keyword` (see `canonicalRedirectHref`).
 */
const legacySearchOwnedParams = new Set(["type", "q"]);

/**
 * Descriptors whose redirect narrows the carried parameters to the ones the
 * destination view actually parses, instead of carrying every incoming
 * parameter across.
 *
 * Only Taxa does this. Its redirect shipped before this generic contract and
 * its narrowing is covered by tests, so it is retained as-is rather than
 * widened here; the narrowing itself is derived from the destination's own
 * collection options, so a filter added to the Taxa view is carried across
 * automatically and there is no parameter list to maintain by hand.
 *
 * The residual risk is a *non-collection* parameter that `/taxonomy` starts
 * reading outside `parseTaxonomyCollectionState` — the shape
 * `/protein-structure` already has with `accession`/`path` — which this
 * narrowing would drop. `search-type-routing.test.ts` guards the collection
 * half by round-tripping the destination URL back through the real Taxa
 * parser; a new non-collection parameter must be added to `carriedParamNames`
 * and to that test's explicit list alongside `tab`.
 */
const narrowedRedirectOptions: Readonly<
  Record<string, CollectionStateOptions | undefined>
> = {
  taxonomy: taxonomyCollectionOptions,
};

function carriedParamNames(
  descriptorId: string,
  params: SearchParamsRecord,
): ReadonlySet<string> | undefined {
  const options = narrowedRedirectOptions[descriptorId];
  if (!options) return undefined;
  // `tab` is owned by the destination page rather than by its collection
  // state, so it rides along with the view's managed parameter names.
  return new Set([...collectionManagedParamNames(params, options), "tab"]);
}

/**
 * The legacy route spelled the Experiment Biosets tab three ways —
 * `type=bioset`, `tab=bioset`, `tab=biosets`. The canonical route accepts only
 * `tab=biosets`, so all three normalize to it.
 */
function requestsBiosetTab(
  searchtype: string,
  params: SearchParamsRecord,
): boolean {
  const tabs = Array.isArray(params.tab) ? params.tab : [params.tab];
  return (
    searchtype === "bioset" ||
    tabs.includes("bioset") ||
    tabs.includes("biosets")
  );
}

/**
 * Migrate a legacy `/search?type=…` request onto its canonical collection
 * route. The contract, in the order the destination query is built:
 *
 * 1. `keyword` carries the formatted query, and is omitted when there is none.
 *    An incoming `keyword` is used only when `q` supplied none, and only its
 *    first value, so the destination never receives two.
 * 2. Every other incoming parameter is carried across with its repeats intact
 *    and in URL order — the destination collections deliberately retain the
 *    parameters they do not own (`mergeWithUnrelatedParams`), so dropping one
 *    here would lose state no later layer can recover. Taxa is the one
 *    exception (see `narrowedRedirectOptions`).
 * 3. Experiment normalizes the Biosets tab (see `requestsBiosetTab`).
 * 4. Descriptor defaults (`route.params`, e.g. Protein's `filter=protein`)
 *    land last and never clobber an explicit incoming value of the same name.
 */
function canonicalRedirectHref(
  descriptorId: string,
  route: CanonicalSearchRoute,
  params: SearchParamsRecord,
  query: string,
  searchtype: string,
): string {
  const carried = carriedParamNames(descriptorId, params);
  const biosetTab =
    descriptorId === "experiment" && requestsBiosetTab(searchtype, params);

  const destination = new URLSearchParams();
  if (query) destination.set("keyword", query);

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || legacySearchOwnedParams.has(name)) continue;
    if (carried && !carried.has(name)) continue;
    // An incoming `keyword` only survives when `q` did not already supply one,
    // and only as a single value: the destination reads `keyword` through
    // `optionalValue`, which takes the first of a repeated parameter, so
    // forwarding all of them would print a URL that lies about what it does.
    if (name === "keyword") {
      if (!destination.has("keyword")) {
        destination.set("keyword", firstSearchParamValue(value));
      }
      continue;
    }
    if (name === "tab" && biosetTab) {
      destination.set("tab", "biosets");
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      destination.append(name, item);
    }
  }
  if (biosetTab && !destination.has("tab")) destination.set("tab", "biosets");

  for (const [name, value] of Object.entries(route.params ?? {})) {
    if (!destination.has(name)) destination.set(name, value);
  }

  return `/${route.segment}${destination.size ? `?${destination.toString()}` : ""}`;
}

/**
 * Legacy types that still render `TypeSearch`: a descriptor with no canonical
 * route, but with a tab group the legacy list knows how to render. Derived
 * rather than listed, so marking a descriptor canonical is by itself enough to
 * redirect it, and a descriptor with neither a canonical route nor tabs can
 * never reach a list that would silently render some other type's tabs.
 */
function rendersTypeSearch(descriptor: SearchType): boolean {
  return descriptor.route.status === "legacy" && descriptor.tabs !== undefined;
}

/** The descriptor a legacy `type` value resolves through, if any. */
export function legacySearchDescriptor(
  searchtype: string,
): SearchType | undefined {
  const id = legacyTypeAliases[searchtype] ?? searchtype;
  return searchDescriptors.find((descriptor) => descriptor.id === id);
}

/**
 * Resolve a legacy `/search` request. `query` is the caller's already-formatted
 * search phrase, which becomes the destination `keyword`.
 */
export function resolveLegacySearch(
  params: SearchParamsRecord,
  query: string,
): LegacySearchTarget {
  const searchtype = firstSearchParamValue(params.type);

  // No `type` at all is the legacy Overview entry point. It resolves here
  // explicitly instead of falling through to a dead end: with a phrase to
  // search it is the all-data-types result page, and without one there is
  // nothing to resolve.
  if (!searchtype) return query ? { kind: "allTypes" } : { kind: "prompt" };
  if (searchtype === "everything") return { kind: "allTypes" };

  const descriptor = legacySearchDescriptor(searchtype);
  if (descriptor?.route.status === "canonical") {
    return {
      kind: "redirect",
      href: canonicalRedirectHref(
        descriptor.id,
        descriptor.route,
        params,
        query,
        searchtype,
      ),
    };
  }
  if (descriptor && rendersTypeSearch(descriptor)) {
    return { kind: "typeSearch", searchtype };
  }
  return { kind: "unsupported", searchtype };
}

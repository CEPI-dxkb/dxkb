import {
  searchDescriptors,
  type SearchRoute,
  type SearchType,
} from "@/constants/search-info";
import { taxonomyCollectionOptions } from "@/lib/taxonomy-view/query";
import { toQueryString } from "@/lib/url";
import {
  collectionManagedParamNames,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import type { SearchParamsRecord } from "@/lib/views/rql";

type CanonicalSearchRoute = Extract<SearchRoute, { status: "canonical" }>;

export function firstSearchParamValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export type LegacySearchTarget =
  /** `redirect()` (307), not `permanentRedirect()`, matching the Taxa and Experiment redirects. */
  | { kind: "redirect"; href: string }
  | { kind: "allTypes" }
  | { kind: "prompt" }
  | { kind: "unsupported"; searchtype: string };

const legacyTypeAliases: Readonly<Record<string, string | undefined>> = {
  bioset: "experiment",
};

/**
 * `type` is the dispatch discriminator and `q` becomes `keyword`, so neither is
 * carried verbatim.
 */
const legacySearchOwnedParams = new Set(["type", "q"]);
const proteinStructureMemberParams = new Set(["accession", "path"]);

/**
 * Descriptors whose redirect narrows carried parameters to those the
 * destination parses (only Taxa, derived from its collection options). A new
 * non-collection parameter on `/taxonomy` must be added to `carriedParamNames`
 * and the test's list alongside `tab`.
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
  // `tab` is owned by the destination page, not its collection state, so it
  // rides along.
  return new Set([...collectionManagedParamNames(params, options), "tab"]);
}

/**
 * The canonical route accepts only `tab=biosets`; legacy spelled it
 * `type=bioset`, `tab=bioset` and `tab=biosets`.
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
 * Destination query order: `keyword` (an incoming one only when `q` supplied
 * none, first value only), other incoming params with repeats intact, the
 * Biosets normalization, then descriptor defaults that never clobber explicit
 * values.
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
    if (
      descriptorId === "protein_structure" &&
      proteinStructureMemberParams.has(name)
    )
      continue;
    if (carried && !carried.has(name)) continue;
    // Only the first incoming `keyword` is forwarded: the destination reads the
    // first of a repeated parameter, so forwarding all would print a URL that
    // lies.
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

  return `/${route.segment}${destination.size ? `?${toQueryString(destination)}` : ""}`;
}

export function legacySearchDescriptor(
  searchtype: string,
): SearchType | undefined {
  const id = legacyTypeAliases[searchtype] ?? searchtype;
  return searchDescriptors.find((descriptor) => descriptor.id === id);
}

export function resolveLegacySearch(
  params: SearchParamsRecord,
  query: string,
): LegacySearchTarget {
  const searchtype = firstSearchParamValue(params.type);

  // No `type` is the legacy Overview entry point: all-data-types results with a
  // phrase, nothing to resolve without one.
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
  return { kind: "unsupported", searchtype };
}

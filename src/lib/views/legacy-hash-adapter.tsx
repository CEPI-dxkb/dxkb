"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toQueryString } from "@/lib/url";
import { clearedFilterValue, rqlNamesField } from "./collection-state";

/**
 * The param that records a removed PATRIC default, for legacy's `#filter=false`
 * (written by every Feature grid once that default is removed): `annotation` on
 * the Feature list and the Taxonomy page's Features tab, `features.annotation`
 * on the Genome list's and Genome page's Features tabs. Those are the key of
 * `featureListDefaultFilters` and those tabs' child URL key, not imported here
 * so this layout-wide component does not pull Feature field metadata into
 * every view's bundle. Undefined where DXKB has no such default: an explicit
 * `rql` that picks an annotation replaces the Feature list's, the Proteins
 * search (`filter=protein`, read without quotes as the server reads it) has
 * none, and neither has any other view or tab.
 */
function removedDefaultParam(
  pathname: string,
  tab: string | null,
  params: URLSearchParams,
): string | undefined {
  if (pathname === "/feature") {
    const rql = params.get("rql");
    const filter = params.get("filter")?.replace(/^"|"$/g, "");
    return (rql !== null && rqlNamesField(rql, "annotation")) ||
      filter === "protein"
      ? undefined
      : "annotation";
  }
  if (tab !== "features") return undefined;
  if (pathname === "/genome" || /^\/genome\/[^/]+$/.test(pathname)) {
    return "features.annotation";
  }
  if (/^\/taxonomy\/[^/]+$/.test(pathname)) return "annotation";
  return undefined;
}

/**
 * Legacy BV-BRC put the active tab in the URL hash (#view_tab=x), which the server
 * cannot read. After a legacy /view/* link is server-redirected (proxy.ts), this client
 * component promotes supported hash parameters into the canonical query string via
 * router.replace so Next.js re-renders without requiring a manual reload.
 */
export function LegacyHashAdapter() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const hashParams = new URLSearchParams(hash);
    const tab = hashParams.get("view_tab");
    const filter = hashParams.get("filter");
    const accession = hashParams.get("accession");
    const path = hashParams.get("path");
    const keyword = hashParams.get("keyword");
    const defaultSort = hashParams.get("defaultSort");
    if (
      tab === null &&
      filter === null &&
      accession === null &&
      path === null &&
      keyword === null &&
      defaultSort === null
    )
      return;

    // A separate URLSearchParams, because mutating url.searchParams re-escapes
    // the whole query (`,` → `%2C`) before toQueryString can keep it readable.
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (tab !== null) params.set("tab", tab);
    if (filter !== null && filter !== "false") params.set("filter", filter);
    const removedDefaultKey =
      filter === "false"
        ? removedDefaultParam(url.pathname, tab, params)
        : undefined;
    if (removedDefaultKey && !params.has(removedDefaultKey)) {
      params.set(removedDefaultKey, clearedFilterValue);
    }
    if (accession !== null) params.set("accession", accession);
    if (path !== null) params.set("path", path);
    if (keyword && !params.has("keyword")) {
      params.set("keyword", keyword);
    }
    if (
      defaultSort === "-score" &&
      params.get("keyword") &&
      !params.has("sort")
    ) {
      params.set("sort", "score:desc");
    }
    const query = toQueryString(params);
    router.replace(`${url.pathname}${query ? `?${query}` : ""}`);
  }, [router]);

  return null;
}

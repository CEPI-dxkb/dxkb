"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toQueryString } from "@/lib/url";
import { clearedFilterValue, rqlNamesField } from "./collection-state";

/**
 * Records a removed PATRIC default (legacy `#filter=false`): `annotation` on
 * the Feature list and the Taxonomy Features tab, `features.annotation` on
 * Genome tabs.
 * Keys are literals rather than imports so this layout-wide component does not
 * pull Feature field metadata into every bundle. Undefined where DXKB has no
 * such default.
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
 * Legacy put the active tab in the URL hash, which the server cannot read;
 * after the proxy redirect this promotes supported hash params into the query
 * string.
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
    // Legacy wrote JBrowse 1 state only beside its browser tab; elsewhere these
    // names are an ordinary anchor or another page's hash.
    const browserTab = tab === "browser" || tab === "genomeBrowser";
    const loc = browserTab ? hashParams.get("loc") : null;
    const tracks = browserTab ? hashParams.get("tracks") : null;
    const highlight = browserTab ? hashParams.get("highlight") : null;
    if (
      tab === null &&
      filter === null &&
      accession === null &&
      path === null &&
      keyword === null &&
      defaultSort === null &&
      loc === null &&
      tracks === null &&
      highlight === null
    )
      return;

    // A separate URLSearchParams, because mutating url.searchParams re-escapes
    // the whole query before toQueryString can keep it readable.
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
    // Literal names, not imported from the Genome Browser's url-state module,
    // so this layout-wide component stays out of its bundle.
    if (loc) params.set("browser.loc", loc);
    if (tracks) params.set("browser.tracks", tracks);
    if (highlight) params.set("browser.highlight", highlight);
    const query = toQueryString(params);
    router.replace(`${url.pathname}${query ? `?${query}` : ""}`);
  }, [router]);

  return null;
}

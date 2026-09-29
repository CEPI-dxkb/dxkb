"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toQueryString } from "@/lib/url";

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

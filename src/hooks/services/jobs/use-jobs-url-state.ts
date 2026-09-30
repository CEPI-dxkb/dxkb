"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  jobsUrlParamNames,
  parseJobsUrlState,
  serializeJobsUrlState,
  type JobsUrlState,
} from "@/lib/jobs/jobs-url-state";
import { toQueryString } from "@/lib/url";

// Same params in any order. Only for comparing addresses, never for building one.
function sameQuery(left: string, right: string): boolean {
  const canonical = (query: string) => {
    const params = new URLSearchParams(query);
    params.sort();
    return params.toString();
  };
  return canonical(left) === canonical(right);
}

/**
 * The jobs list's filters, sort and page, owned by the URL so a refresh, Back from a
 * job's workspace folder, or a shared link shows the same list. Writes use the native
 * History API, which Next keeps in sync with useSearchParams; the jobs page fetches
 * client-side, so a router navigation would only add a server round trip.
 *
 * Every write pushes an entry, except that `history: "coalesce"` writes (the search
 * box's debounced commits) share one: the first pushes, and each later one replaces
 * that entry while it is still the current one. Any other write, or any Back/Forward,
 * ends the run, so a search never overwrites a status or sort entry, nor an earlier
 * entry that happens to share its address.
 */
export function useJobsUrlState() {
  const searchParams = useSearchParams();
  const state = parseJobsUrlState(new URLSearchParams(searchParams.toString()));
  // The address the last "coalesce" write left, until another write replaces it.
  const coalescedAddress = useRef<{ pathname: string; query: string } | null>(
    null,
  );
  // An address names a state, not an entry: Back can land on an earlier entry
  // with the same one, so a traversal ends the run whatever the address.
  useEffect(() => {
    const endRun = () => {
      coalescedAddress.current = null;
    };
    window.addEventListener("popstate", endRun);
    return () => {
      window.removeEventListener("popstate", endRun);
    };
  }, []);
  const setState = (
    patch: Partial<JobsUrlState>,
    { history = "push" }: { history?: "push" | "coalesce" } = {},
  ) => {
    // Merge onto the live URL, not the last render's: a write that has not
    // reached a render yet (Next applies it in a transition) must survive.
    const { pathname, search, hash } = window.location;
    const params = new URLSearchParams(search);
    const next = serializeJobsUrlState({
      ...parseJobsUrlState(params),
      ...patch,
    });
    // Params the list does not own (`utm_source`) stay, ahead of the ones it does,
    // and so does the hash.
    for (const name of jobsUrlParamNames) params.delete(name);
    for (const [name, value] of next) params.append(name, value);
    const query = toQueryString(params);
    // Nothing changed: no entry, so Back never lands on the page it is leaving
    // (the current page number, or a date cleared when none is applied).
    if (sameQuery(query, search)) return;
    const url = `${pathname}${query ? `?${query}` : ""}${hash}`;
    const own = coalescedAddress.current;
    const onOwnEntry =
      own !== null && own.pathname === pathname && sameQuery(own.query, search);
    if (history === "coalesce" && onOwnEntry) {
      window.history.replaceState(null, "", url);
    } else {
      window.history.pushState(null, "", url);
    }
    coalescedAddress.current =
      history === "coalesce" ? { pathname, query } : null;
  };
  return [state, setState] as const;
}

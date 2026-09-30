"use client";

import { useSearchParams } from "next/navigation";
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
 */
export function useJobsUrlState() {
  const searchParams = useSearchParams();
  const state = parseJobsUrlState(new URLSearchParams(searchParams.toString()));
  const setState = (
    patch: Partial<JobsUrlState>,
    { history = "push" }: { history?: "push" | "replace" } = {},
  ) => {
    // Merge onto the live URL, not the last render's: a write that has not
    // reached a render yet (Next applies it in a transition) must survive.
    const { pathname, search } = window.location;
    const params = new URLSearchParams(search);
    const next = serializeJobsUrlState({
      ...parseJobsUrlState(params),
      ...patch,
    });
    // Params the list does not own (`utm_source`) stay, ahead of the ones it does.
    for (const name of jobsUrlParamNames) params.delete(name);
    for (const [name, value] of next) params.append(name, value);
    const query = toQueryString(params);
    // Nothing changed: no entry, so Back never lands on the page it is leaving
    // (the current page number, or a date cleared when none is applied).
    if (sameQuery(query, search)) return;
    const url = query ? `${pathname}?${query}` : pathname;
    if (history === "replace") window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  };
  return [state, setState] as const;
}

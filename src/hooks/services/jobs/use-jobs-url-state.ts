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
 * Jobs list state owned by the URL, written with the native History API. `history: "coalesce"` writes share one entry: the first pushes, later ones replace it while it is current; any other write or Back/Forward ends the run.
 */
export function useJobsUrlState() {
  const searchParams = useSearchParams();
  const state = parseJobsUrlState(new URLSearchParams(searchParams.toString()));
  const coalescedAddress = useRef<{ pathname: string; query: string } | null>(
    null,
  );
  // Back can land on an earlier entry with the same address, so a traversal ends the run.
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
    // Merge onto the live URL: a write not yet rendered (Next applies it in a transition) must survive.
    const { pathname, search, hash } = window.location;
    const params = new URLSearchParams(search);
    const next = serializeJobsUrlState({
      ...parseJobsUrlState(params),
      ...patch,
    });
    for (const name of jobsUrlParamNames) params.delete(name);
    for (const [name, value] of next) params.append(name, value);
    const query = toQueryString(params);
    // Nothing changed: no entry, so Back never lands on the page it is leaving.
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

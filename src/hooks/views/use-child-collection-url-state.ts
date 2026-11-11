"use client";

import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import {
  parseChildCollectionState,
  replaceChildCollectionSearchParams,
  type ChildCollectionUrlKey,
} from "@/lib/views/child-collection-state";
import {
  toSearchParamsRecord,
  type CollectionState,
  type CollectionStateOptions,
} from "@/lib/views/collection-state";
import { toQueryString } from "@/lib/url";

let pushedThisTask = false;

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
 * A nested table's state under `<urlKey>.` params, written with the History API; the hash is kept (legacy links use it).
 * One user action is one Back step: only the first push in a task adds an entry, later writes replace it.
 */
export function useChildCollectionUrlState(
  urlKey: ChildCollectionUrlKey,
  options: CollectionStateOptions,
): readonly [
  CollectionState,
  (next: CollectionState, history?: "push" | "replace") => void,
] {
  const searchParams = useTabContentSearchParams();
  const state = parseChildCollectionState(
    toSearchParamsRecord(new URLSearchParams(searchParams.toString())),
    urlKey,
    options,
  );
  const setState = (
    next: CollectionState,
    history: "push" | "replace" = "push",
  ) => {
    // Merge onto the live URL: a write not yet rendered (Next applies it in a transition) must survive.
    const query = toQueryString(
      replaceChildCollectionSearchParams(
        toSearchParamsRecord(new URLSearchParams(window.location.search)),
        urlKey,
        next,
        options,
      ),
    );
    const live = window.location;
    if (sameQuery(query, live.search)) return;
    const url = `${live.pathname}${query ? `?${query}` : ""}${live.hash}`;
    if (history === "push" && !pushedThisTask) {
      window.history.pushState(null, "", url);
      pushedThisTask = true;
      queueMicrotask(() => {
        pushedThisTask = false;
      });
    } else {
      window.history.replaceState(null, "", url);
    }
  };
  return [state, setState] as const;
}

/** Drops a nested table's page param without a history entry. */
export function resetChildCollectionPage(urlKey: ChildCollectionUrlKey): void {
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  if (!params.has(`${urlKey}.page`)) return;
  params.delete(`${urlKey}.page`);
  const query = toQueryString(params);
  window.history.replaceState(
    null,
    "",
    `${pathname}${query ? `?${query}` : ""}${hash}`,
  );
}

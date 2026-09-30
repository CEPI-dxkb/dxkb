"use client";

import { useSearchParams } from "next/navigation";
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

// True from a push until the end of the JS task that made it.
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
 * A nested table's state under `<urlKey>.` params. Writes use the native History API:
 * no server component reads child params, so a router navigation would re-render
 * the page's server tree for nothing. The hash is kept (legacy links use it).
 *
 * One user action is one Back step. A single event can report several changes (a
 * sort click resets the page, then sets the sort; a keyword commit resets the page,
 * then writes the state), so a write that would leave the address as it is does
 * nothing, and only the first push in a task adds an entry: later writes in that
 * task replace it, so it ends up holding the final state.
 */
export function useChildCollectionUrlState(
  urlKey: ChildCollectionUrlKey,
  options: CollectionStateOptions,
): readonly [
  CollectionState,
  (next: CollectionState, history?: "push" | "replace") => void,
] {
  const searchParams = useSearchParams();
  const state = parseChildCollectionState(
    toSearchParamsRecord(new URLSearchParams(searchParams.toString())),
    urlKey,
    options,
  );
  const setState = (
    next: CollectionState,
    history: "push" | "replace" = "push",
  ) => {
    // Merge onto the live URL, path included, not the last render's: a write that
    // has not reached a render yet (Next applies it in a transition) must survive,
    // such as a sibling table's, a tab click's or a page reset's.
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

/**
 * Drop a nested table's page param without a history entry. For an event that
 * changes the table's scope from outside, such as the Interactions shell's shared
 * keyword box.
 */
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

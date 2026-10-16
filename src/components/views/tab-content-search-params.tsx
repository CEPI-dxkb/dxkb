"use client";

import { useSearchParams } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

/** The search a stale tab render reads instead of the URL, or null for the URL. */
const HeldSearchContext = createContext<string | null>(null);

interface TabContentSearchParamsProps {
  /** The `tab` search param the server rendered this content for (null: none). */
  tab: string | null;
  children: ReactNode;
}

/**
 * Keeps a server-rendered tab's content on its own URL while Back or Forward
 * replaces it with another tab.
 *
 * Next keys a page's React state without its search params, so `?tab=genomes&…`
 * and the Overview's bare URL are one subtree. React renders a popstate
 * transition at sync priority, and at that priority the `useDeferredValue` in
 * Next's `InnerLayoutRouter` keeps the previous page's RSC for one commit while
 * `useSearchParams()` already returns the destination URL. The leaving tab
 * re-renders against a URL that is not its own: a filtered collection drops its
 * filter, shows "Loading results..." and fetches the unfiltered rows before the
 * destination replaces it.
 *
 * Only that frame puts a `tab` in the URL that differs from the one the server
 * rendered: tab changes go through `router.push`, which commits the URL and the
 * new RSC together, and the History API writes of nested tables never touch
 * `tab`. In that frame the content reads the last search it matched, so it
 * renders exactly as before and starts no request.
 */
export function TabContentSearchParams({
  tab,
  children,
}: TabContentSearchParamsProps) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isCurrent = searchParams.get("tab") === tab;
  // Null until the content has matched the URL once, so a mismatch that is not
  // that frame falls back to the URL instead of freezing the content.
  const [matchedSearch, setMatchedSearch] = useState(
    isCurrent ? search : null,
  );
  if (isCurrent && matchedSearch !== search) setMatchedSearch(search);
  return (
    <HeldSearchContext.Provider value={isCurrent ? null : matchedSearch}>
      {children}
    </HeldSearchContext.Provider>
  );
}

/**
 * `useSearchParams()` for tab content: during Back/Forward's stale frame (see
 * `TabContentSearchParams`) the search the content was rendered for, otherwise,
 * and outside a tab shell, the URL's.
 */
export function useTabContentSearchParams(): URLSearchParams {
  const searchParams = useSearchParams();
  const heldSearch = useContext(HeldSearchContext);
  return heldSearch === null ? searchParams : new URLSearchParams(heldSearch);
}

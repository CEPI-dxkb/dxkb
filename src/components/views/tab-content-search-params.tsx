"use client";

import { useSearchParams } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

const HeldSearchContext = createContext<string | null>(null);

interface TabContentSearchParamsProps {
  tab: string | null;
  children: ReactNode;
}

/**
 * Next keys a page's React state without its search params, and on a popstate
 * the `useDeferredValue` in `InnerLayoutRouter` keeps the previous RSC for one
 * commit while `useSearchParams()` already returns the destination URL. In that
 * frame the content reads the last search it matched instead, so it renders as
 * before and starts no request.
 */
export function TabContentSearchParams({
  tab,
  children,
}: TabContentSearchParamsProps) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isCurrent = searchParams.get("tab") === tab;
  // Null until the content has matched the URL once, so a mismatch outside that
  // frame falls back to the URL.
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

export function useTabContentSearchParams(): URLSearchParams {
  const searchParams = useSearchParams();
  const heldSearch = useContext(HeldSearchContext);
  return heldSearch === null ? searchParams : new URLSearchParams(heldSearch);
}

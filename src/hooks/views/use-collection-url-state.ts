"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type {
  CollectionState,
  CollectionStateOptions,
} from "@/lib/views/collection-state";
import {
  canonicalizeCollectionSearchParams,
  parseCollectionState,
  replaceCollectionSearchParams,
  toSearchParamsRecord,
} from "@/lib/views/collection-state";
import { toQueryString } from "@/lib/url";
import { withoutChildCollectionParams } from "@/lib/views/child-collection-state";

export function useCollectionUrlState<Sort extends string>(
  options: CollectionStateOptions<Sort>,
): [CollectionState<Sort>, (state: CollectionState<Sort>) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = toSearchParamsRecord(
    new URLSearchParams(searchParams.toString()),
  );
  const state = parseCollectionState(current, options);

  const setState = (next: CollectionState<Sort>) => {
    // A new parent query is a new scope for every nested table.
    const merged = replaceCollectionSearchParams(
      withoutChildCollectionParams(current),
      next,
      options,
    );
    router.push(
      merged.size ? `${pathname}?${toQueryString(merged)}` : pathname,
      {
        scroll: false,
      },
    );
  };

  const canonical = canonicalizeCollectionSearchParams(current, options);
  // Compare in URLSearchParams form: useSearchParams().toString() re-escapes
  // whatever the address bar holds, so comparing the readable string would
  // never match and the effect would replace the URL forever.
  const canonicalSearch = canonical.toString();
  const currentSearch = searchParams.toString();
  const readableSearch = toQueryString(canonical);
  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      router.replace(
        readableSearch ? `${pathname}?${readableSearch}` : pathname,
        {
          scroll: false,
        },
      );
    }
  }, [canonicalSearch, currentSearch, readableSearch, pathname, router]);

  return [state, setState];
}

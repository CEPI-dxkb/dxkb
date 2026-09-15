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
    const merged = replaceCollectionSearchParams(current, next, options);
    router.push(merged.size ? `${pathname}?${merged}` : pathname, {
      scroll: false,
    });
  };

  const canonical = canonicalizeCollectionSearchParams(current, options);
  const canonicalSearch = canonical.toString();
  const currentSearch = searchParams.toString();
  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      router.replace(
        canonicalSearch ? `${pathname}?${canonicalSearch}` : pathname,
        {
          scroll: false,
        },
      );
    }
  }, [canonicalSearch, currentSearch, pathname, router]);

  return [state, setState];
}

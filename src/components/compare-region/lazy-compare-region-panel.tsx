"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `next/dynamic` called from a Server Component does not code-split a Client
 * Component, so the dynamic import lives here.
 */
export const LazyCompareRegionPanel = dynamic(
  () =>
    import("./compare-region-panel").then((module) => module.CompareRegionPanel),
  { loading: () => <Skeleton className="m-3 h-64" /> },
);

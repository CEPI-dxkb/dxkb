"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Compare Region Viewer as its own chunk, so the Feature View's other tabs
 * do not ship it. The member page is a Server Component, and `next/dynamic`
 * called from one does not code-split a Client Component, so the dynamic
 * import lives here (as in `lazy-genome-browser-panel.tsx`).
 */
export const LazyCompareRegionPanel = dynamic(
  () =>
    import("./compare-region-panel").then((module) => module.CompareRegionPanel),
  { loading: () => <Skeleton className="m-3 h-64" /> },
);

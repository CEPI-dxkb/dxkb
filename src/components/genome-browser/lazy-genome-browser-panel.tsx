"use client";

import dynamic from "next/dynamic";
import { GenomeBrowserSkeleton } from "./genome-browser-skeleton";

/**
 * `next/dynamic` called from a Server Component does not code-split a Client
 * Component, so the dynamic import lives here.
 */
export const LazyGenomeBrowserPanel = dynamic(
  () =>
    import("./genome-browser-panel").then(
      (module) => module.GenomeBrowserPanel,
    ),
  { loading: () => <GenomeBrowserSkeleton /> },
);

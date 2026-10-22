"use client";

import dynamic from "next/dynamic";
import { GenomeBrowserSkeleton } from "./genome-browser-skeleton";

/**
 * The Genome Browser panel as its own chunk, so the Genome and Feature Views'
 * other tabs do not ship it (or the client it reads through). The member
 * pages are Server Components, and `next/dynamic` called from a Server
 * Component does not code-split a Client Component, so the dynamic import
 * lives here, in a Client Component of its own.
 */
export const LazyGenomeBrowserPanel = dynamic(
  () =>
    import("./genome-browser-panel").then(
      (module) => module.GenomeBrowserPanel,
    ),
  { loading: () => <GenomeBrowserSkeleton /> },
);

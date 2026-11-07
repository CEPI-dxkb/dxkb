"use client";

import dynamic from "next/dynamic";

import { ReferenceGenomesSkeleton } from "./reference-genomes-skeleton";

/**
 * The Overview reference genomes card as its own chunk (SSR on), so only an
 * Overview ships the table; see docs/architecture.md, "Views & organism
 * landing".
 */
export const LazyReferenceGenomesClient = dynamic(
  () =>
    import("./reference-genomes-client").then(
      (module) => module.ReferenceGenomesClient,
    ),
  { loading: ReferenceGenomesSkeleton },
);

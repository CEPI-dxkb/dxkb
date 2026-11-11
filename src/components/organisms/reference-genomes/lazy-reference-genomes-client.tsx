"use client";

import dynamic from "next/dynamic";

import { ReferenceGenomesSkeleton } from "./reference-genomes-skeleton";

/** The Overview reference genomes card as its own chunk, so only an Overview ships the table. */
export const LazyReferenceGenomesClient = dynamic(
  () =>
    import("./reference-genomes-client").then(
      (module) => module.ReferenceGenomesClient,
    ),
  { loading: ReferenceGenomesSkeleton },
);

"use client";

import { DataRepository } from "@/lib/data-api";
import {
  genomeCollectionOptions,
  genomeCollectionProfile,
  type GenomeViewRecord,
} from "@/lib/genome-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface GenomeResourceCollectionProps {
  baseRql?: string;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
}

export function GenomeResourceCollection({
  baseRql,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: GenomeResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(genomeCollectionOptions);
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<GenomeViewRecord>
      profile={genomeCollectionProfile}
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
    />
  );
}

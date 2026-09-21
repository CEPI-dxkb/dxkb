"use client";

import { DataRepository } from "@/lib/data-api";
import {
  epitopeCollectionOptions,
  epitopeCollectionProfile,
  type EpitopeViewRecord,
} from "@/lib/epitope-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface EpitopeResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
}

export function EpitopeResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: EpitopeResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(epitopeCollectionOptions);
  const state = initialState ?? urlState;
  return (
    <ResourceCollection<EpitopeViewRecord>
      profile={enableFacets ? epitopeCollectionProfile : { ...epitopeCollectionProfile, facets: undefined }}
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
    />
  );
}

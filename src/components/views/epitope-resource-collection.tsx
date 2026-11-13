"use client";

import { DataRepository } from "@/lib/data-api";
import {
  epitopeCollectionOptions,
  epitopeCollectionProfile,
  type EpitopeViewRecord,
} from "@/lib/epitope-view";
import {
  filtersBesideRql,
  type CollectionState,
} from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface EpitopeResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
  serverKeywordMode?: "exact" | "prefix";
}

export function EpitopeResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: EpitopeResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(epitopeCollectionOptions);
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? epitopeCollectionProfile
    : { ...epitopeCollectionProfile, facets: undefined };
  return (
    <ResourceCollection<EpitopeViewRecord>
      profile={serverKeywordMode ? { ...profile, serverKeywordMode } : profile}
      repository={repository}
      state={state}
      filtersBesideRql={[
        ...filtersBesideRql(state.rql, epitopeCollectionOptions),
      ]}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
    />
  );
}

"use client";

import { DataRepository, type DataSort } from "@/lib/data-api";
import {
  featureCollectionOptions,
  featureCollectionProfile,
  type FeatureViewRecord,
} from "@/lib/feature-view";
import {
  facetCountState,
  filtersBesideRql,
  type CollectionState,
  type CollectionStateOptions,
  withUnshadowedDefaults,
} from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface FeatureResourceCollectionProps {
  baseRql?: string;
  collectionOptions?: CollectionStateOptions;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
  serverKeywordMode?: "exact" | "prefix";
  unsortedOrder?: DataSort;
}

export function FeatureResourceCollection({
  baseRql,
  collectionOptions = featureCollectionOptions,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
  unsortedOrder,
}: FeatureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(collectionOptions);
  const state = initialState ?? urlState;
  const profile = {
    ...featureCollectionProfile,
    ...(!enableFacets && { facets: undefined }),
    ...(serverKeywordMode && { serverKeywordMode }),
    ...(unsortedOrder && { unsortedOrder }),
  };
  return (
    <ResourceCollection<FeatureViewRecord>
      profile={profile}
      repository={repository}
      state={state}
      facetState={facetCountState(state, collectionOptions)}
      filtersBesideRql={[...filtersBesideRql(state.rql, collectionOptions)]}
      onStateChange={(next, change) => {
        setState(
          change?.clearAll
            ? next
            : withUnshadowedDefaults(state.rql, next, collectionOptions),
        );
      }}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
    />
  );
}

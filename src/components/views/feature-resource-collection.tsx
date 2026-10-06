"use client";

import { DataRepository } from "@/lib/data-api";
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
  /**
   * The URL schema. The `/feature` list passes `featureListOptionsFor(state)`:
   * `featureListCollectionOptions` (legacy FeatureList's removable
   * `annotation=PATRIC` default, which the taxon Features tab shares), or on
   * the Proteins search the shared `featureCollectionOptions`, which has none.
   */
  collectionOptions?: CollectionStateOptions;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
  /**
   * How a URL keyword reaches the Data API. The `/feature` list sends an exact
   * `keyword(...)`, as legacy FeatureList and the All Data Types search do;
   * unset keeps the token-prefix default.
   */
  serverKeywordMode?: "exact" | "prefix";
}

export function FeatureResourceCollection({
  baseRql,
  collectionOptions = featureCollectionOptions,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: FeatureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(collectionOptions);
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? featureCollectionProfile
    : { ...featureCollectionProfile, facets: undefined };
  return (
    <ResourceCollection<FeatureViewRecord>
      profile={serverKeywordMode ? { ...profile, serverKeywordMode } : profile}
      repository={repository}
      state={state}
      facetState={facetCountState(state, collectionOptions)}
      filtersBesideRql={[...filtersBesideRql(state.rql, collectionOptions)]}
      onStateChange={(next, change) => {
        // A facet pick that replaces an rql naming `annotation` brings the
        // PATRIC default back; "Clear All Filters" removes it with the rest.
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

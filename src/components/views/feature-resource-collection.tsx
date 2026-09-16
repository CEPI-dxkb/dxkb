"use client";

import { DataRepository } from "@/lib/data-api";
import {
  featureCollectionOptions,
  featureCollectionProfile,
  type FeatureViewRecord,
} from "@/lib/feature-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface FeatureResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
}

export function FeatureResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: FeatureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(featureCollectionOptions);
  const state = initialState ?? urlState;
  return (
    <ResourceCollection<FeatureViewRecord>
      profile={
        enableFacets
          ? featureCollectionProfile
          : { ...featureCollectionProfile, facets: undefined }
      }
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
    />
  );
}

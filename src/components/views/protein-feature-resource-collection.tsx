"use client";

import { Suspense } from "react";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  proteinFeatureCollectionOptions,
  proteinFeatureCollectionProfile,
  type ProteinFeatureViewRecord,
} from "@/lib/protein-feature-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface ProteinFeatureResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
}

function ProteinFeatureResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: ProteinFeatureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    proteinFeatureCollectionOptions,
  );
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<ProteinFeatureViewRecord>
      profile={
        enableFacets
          ? proteinFeatureCollectionProfile
          : { ...proteinFeatureCollectionProfile, facets: undefined }
      }
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
      prefetchNextPage
    />
  );
}

export function ProteinFeatureResourceCollection(
  props: ProteinFeatureResourceCollectionProps,
) {
  return (
    <Suspense fallback={null}>
      <ProteinFeatureResourceCollectionContent {...props} />
    </Suspense>
  );
}

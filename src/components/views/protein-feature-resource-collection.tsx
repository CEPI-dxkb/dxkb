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
  /**
   * How a URL keyword reaches the Data API. The list page sends an exact
   * `keyword(...)`, as legacy BV-BRC's list and the All Data Types search do;
   * unset keeps the token-prefix default.
   */
  serverKeywordMode?: "exact" | "prefix";
}

function ProteinFeatureResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: ProteinFeatureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    proteinFeatureCollectionOptions,
  );
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? proteinFeatureCollectionProfile
    : { ...proteinFeatureCollectionProfile, facets: undefined };

  return (
    <ResourceCollection<ProteinFeatureViewRecord>
      profile={serverKeywordMode ? { ...profile, serverKeywordMode } : profile}
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      keywordMode={keywordMode}
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

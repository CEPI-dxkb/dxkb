"use client";

import { DataRepository } from "@/lib/data-api";
import {
  experimentCollectionOptions,
  experimentCollectionProfile,
  type ExperimentViewRecord,
} from "@/lib/experiment-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface ExperimentResourceCollectionProps {
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

export function ExperimentResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: ExperimentResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(experimentCollectionOptions);
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? experimentCollectionProfile
    : { ...experimentCollectionProfile, facets: undefined };
  return (
    <ResourceCollection<ExperimentViewRecord>
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

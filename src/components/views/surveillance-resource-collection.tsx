"use client";

import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  surveillanceCollectionOptions,
  surveillanceCollectionProfile,
  type SurveillanceViewRecord,
} from "@/lib/surveillance-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface SurveillanceResourceCollectionProps {
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

export function SurveillanceResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: SurveillanceResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    surveillanceCollectionOptions,
  );
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? surveillanceCollectionProfile
    : { ...surveillanceCollectionProfile, facets: undefined };

  return (
    <ResourceCollection<SurveillanceViewRecord>
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

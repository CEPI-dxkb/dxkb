"use client";

import { Suspense } from "react";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  serologyCollectionOptions,
  serologyCollectionProfile,
  type SerologyViewRecord,
} from "@/lib/serology-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface SerologyResourceCollectionProps {
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

function SerologyResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: SerologyResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(serologyCollectionOptions);
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? serologyCollectionProfile
    : { ...serologyCollectionProfile, facets: undefined };

  return (
    <ResourceCollection<SerologyViewRecord>
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

export function SerologyResourceCollection(
  props: SerologyResourceCollectionProps,
) {
  return (
    <Suspense fallback={null}>
      <SerologyResourceCollectionContent {...props} />
    </Suspense>
  );
}

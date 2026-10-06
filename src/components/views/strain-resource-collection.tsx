"use client";

import { Suspense } from "react";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  strainCollectionOptions,
  strainCollectionProfile,
  type StrainViewRecord,
} from "@/lib/strain-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface StrainResourceCollectionProps {
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

function StrainResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: StrainResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(strainCollectionOptions);
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? strainCollectionProfile
    : { ...strainCollectionProfile, facets: undefined };

  return (
    <ResourceCollection<StrainViewRecord>
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

export function StrainResourceCollection(props: StrainResourceCollectionProps) {
  return (
    <Suspense fallback={null}>
      <StrainResourceCollectionContent {...props} />
    </Suspense>
  );
}

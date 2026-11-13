"use client";

import { Suspense } from "react";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  strainCollectionOptions,
  strainCollectionProfile,
  type StrainViewRecord,
} from "@/lib/strain-view";
import {
  filtersBesideRql,
  type CollectionState,
} from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface StrainResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
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
      filtersBesideRql={[
        ...filtersBesideRql(state.rql, strainCollectionOptions),
      ]}
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

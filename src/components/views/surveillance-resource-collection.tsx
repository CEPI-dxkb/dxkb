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
}

export function SurveillanceResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: SurveillanceResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    surveillanceCollectionOptions,
  );
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<SurveillanceViewRecord>
      profile={
        enableFacets
          ? surveillanceCollectionProfile
          : { ...surveillanceCollectionProfile, facets: undefined }
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

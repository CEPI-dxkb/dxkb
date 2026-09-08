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
}

export function ExperimentResourceCollection({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: ExperimentResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(experimentCollectionOptions);
  const state = initialState ?? urlState;
  return (
    <ResourceCollection<ExperimentViewRecord>
      profile={enableFacets ? experimentCollectionProfile : { ...experimentCollectionProfile, facets: undefined }}
      repository={repository}
      state={state}
      onStateChange={setState}
      baseRql={baseRql}
      enableRowLinks={enableRowLinks}
      showHeader={false}
      keywordMode={keywordMode}
    />
  );
}

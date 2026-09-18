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
}

function SerologyResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: SerologyResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(serologyCollectionOptions);
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<SerologyViewRecord>
      profile={
        enableFacets
          ? serologyCollectionProfile
          : { ...serologyCollectionProfile, facets: undefined }
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

export function SerologyResourceCollection(
  props: SerologyResourceCollectionProps,
) {
  return (
    <Suspense fallback={null}>
      <SerologyResourceCollectionContent {...props} />
    </Suspense>
  );
}

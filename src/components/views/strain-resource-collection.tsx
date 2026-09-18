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
}

function StrainResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: StrainResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(strainCollectionOptions);
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<StrainViewRecord>
      profile={
        enableFacets
          ? strainCollectionProfile
          : { ...strainCollectionProfile, facets: undefined }
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

export function StrainResourceCollection(props: StrainResourceCollectionProps) {
  return (
    <Suspense fallback={null}>
      <StrainResourceCollectionContent {...props} />
    </Suspense>
  );
}

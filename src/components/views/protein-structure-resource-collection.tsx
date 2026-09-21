"use client";

import { Suspense } from "react";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { DataRepository } from "@/lib/data-api";
import {
  proteinStructureCollectionOptions,
  proteinStructureCollectionProfile,
  type ProteinStructureViewRecord,
} from "@/lib/protein-structure-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface ProteinStructureResourceCollectionProps {
  baseRql?: string;
  enableFacets?: boolean;
  enableRowLinks?: boolean;
  initialState?: CollectionState;
  keywordMode?: "server" | "loaded" | "refine";
}

function ProteinStructureResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
}: ProteinStructureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    proteinStructureCollectionOptions,
  );
  const state = initialState ?? urlState;

  return (
    <ResourceCollection<ProteinStructureViewRecord>
      profile={
        enableFacets
          ? proteinStructureCollectionProfile
          : { ...proteinStructureCollectionProfile, facets: undefined }
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

export function ProteinStructureResourceCollection(
  props: ProteinStructureResourceCollectionProps,
) {
  return (
    <Suspense fallback={null}>
      <ProteinStructureResourceCollectionContent {...props} />
    </Suspense>
  );
}

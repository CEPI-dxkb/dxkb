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
  /**
   * How a URL keyword reaches the Data API. The list page sends an exact
   * `keyword(...)`, as legacy BV-BRC's list and the All Data Types search do;
   * unset keeps the token-prefix default.
   */
  serverKeywordMode?: "exact" | "prefix";
}

function ProteinStructureResourceCollectionContent({
  baseRql,
  enableFacets = true,
  enableRowLinks = true,
  initialState,
  keywordMode = "server",
  serverKeywordMode,
}: ProteinStructureResourceCollectionProps) {
  const [urlState, setState] = useCollectionUrlState(
    proteinStructureCollectionOptions,
  );
  const state = initialState ?? urlState;
  const profile = enableFacets
    ? proteinStructureCollectionProfile
    : { ...proteinStructureCollectionProfile, facets: undefined };

  return (
    <ResourceCollection<ProteinStructureViewRecord>
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

export function ProteinStructureResourceCollection(
  props: ProteinStructureResourceCollectionProps,
) {
  return (
    <Suspense fallback={null}>
      <ProteinStructureResourceCollectionContent {...props} />
    </Suspense>
  );
}

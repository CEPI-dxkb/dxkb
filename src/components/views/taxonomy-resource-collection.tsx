"use client";

import { DataRepository } from "@/lib/data-api";
import {
  taxonomyCollectionOptions,
  taxonomyCollectionProfile,
  type TaxonomyViewRecord,
} from "@/lib/taxonomy-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { useCollectionUrlState } from "@/hooks/views/use-collection-url-state";
import { ResourceCollection } from "./resource-collection";

const repository = new DataRepository();

interface TaxonomyResourceCollectionProps {
  initialState: CollectionState;
}

export function TaxonomyResourceCollection({
  initialState,
}: TaxonomyResourceCollectionProps) {
  const [, setState] = useCollectionUrlState(taxonomyCollectionOptions);
  return (
    <ResourceCollection<TaxonomyViewRecord>
      profile={taxonomyCollectionProfile}
      repository={repository}
      state={initialState}
      onStateChange={setState}
      showHeader={false}
      keywordMode="refine"
      prefetchNextPage
    />
  );
}

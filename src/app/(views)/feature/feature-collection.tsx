"use client";

import { viewIcons } from "@/components/views/view-icons";
import { EntityViewShell, FeatureResourceCollection } from "@/components/views";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import {
  featureGridDefaultOrder,
  featureListOptionsFor,
} from "@/lib/feature-view";
import type { CollectionState } from "@/lib/views/collection-state";

interface FeatureCollectionProps {
  initialState: CollectionState;
}

export function FeatureCollection({
  initialState,
}: FeatureCollectionProps) {
  // Legacy FeatureList: a removable annotation=PATRIC default (none on
  // Proteins, which pins it) and an exact keyword(...). A global search adds
  // #defaultSort=-score, so it keeps relevance order.
  const isKeywordSearch = keywordQuery(initialState.keyword ?? "").length > 0;
  return (
    <EntityViewShell
      viewLabel="Feature View"
      title="Features"
      tabs={[{ key: "features", label: "Features", icon: viewIcons.features }]}
      activeTab="features"
      defaultTab="features"
      layout="fill"
    >
      <FeatureResourceCollection
        collectionOptions={featureListOptionsFor(initialState)}
        serverKeywordMode="exact"
        initialState={initialState}
        keywordMode="refine"
        unsortedOrder={isKeywordSearch ? undefined : featureGridDefaultOrder}
      />
    </EntityViewShell>
  );
}

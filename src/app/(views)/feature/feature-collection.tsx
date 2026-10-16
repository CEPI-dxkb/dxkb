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
  // Legacy FeatureList: a removable annotation=PATRIC default (none on the
  // Proteins search, which pins PATRIC itself) and an exact keyword(...), the
  // form its grid and the All Data Types search send. Its grid's order
  // applies unless a keyword search opened it: the global search adds
  // #defaultSort=-score, so a search keeps the backend's relevance order. Text
  // without terms (blank, `""`, only syntax) searches for nothing, so it is
  // not one.
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

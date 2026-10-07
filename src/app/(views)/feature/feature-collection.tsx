"use client";

import { Blocks } from "lucide-react";
import { EntityViewShell, FeatureResourceCollection } from "@/components/views";
import { featureListOptionsFor } from "@/lib/feature-view";
import type { CollectionState } from "@/lib/views/collection-state";

interface FeatureCollectionProps {
  initialState: CollectionState;
}

export function FeatureCollection({
  initialState,
}: FeatureCollectionProps) {
  // Legacy FeatureList: a removable annotation=PATRIC default (none on the
  // Proteins search, which pins PATRIC itself) and an exact keyword(...), the
  // form its grid and the All Data Types search send.
  return (
    <EntityViewShell
      viewLabel="Feature View"
      title="Features"
      tabs={[{ key: "features", label: "Features", icon: <Blocks /> }]}
      activeTab="features"
      defaultTab="features"
      layout="fill"
    >
      <FeatureResourceCollection
        collectionOptions={featureListOptionsFor(initialState)}
        serverKeywordMode="exact"
        initialState={initialState}
        keywordMode="refine"
      />
    </EntityViewShell>
  );
}

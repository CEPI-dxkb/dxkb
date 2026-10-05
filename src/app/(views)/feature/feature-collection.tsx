"use client";

import { Blocks } from "lucide-react";
import { EntityViewShell, FeatureResourceCollection } from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface FeatureCollectionProps {
  initialState: CollectionState;
}

export function FeatureCollection({
  initialState,
}: FeatureCollectionProps) {
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
        initialState={initialState}
        keywordMode="refine"
      />
    </EntityViewShell>
  );
}

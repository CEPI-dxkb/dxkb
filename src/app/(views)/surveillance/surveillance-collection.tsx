"use client";

import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  SurveillanceResourceCollection,
} from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface SurveillanceCollectionProps {
  initialState: CollectionState;
}

export function SurveillanceCollection({
  initialState,
}: SurveillanceCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Surveillance View"
      title="Surveillance"
      tabs={[
        { key: "surveillance", label: "Surveillance", icon: viewIcons.surveillance },
      ]}
      activeTab="surveillance"
      defaultTab="surveillance"
      layout="fill"
    >
      <SurveillanceResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

"use client";

import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  ProteinFeatureResourceCollection,
} from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface DomainsAndMotifsCollectionProps {
  initialState: CollectionState;
}

export function DomainsAndMotifsCollection({
  initialState,
}: DomainsAndMotifsCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Domains and Motifs View"
      title="Domains and Motifs"
      tabs={[
        {
          key: "proteinFeatures",
          label: "Domains and Motifs",
          icon: viewIcons.domainsAndMotifs,
        },
      ]}
      activeTab="proteinFeatures"
      defaultTab="proteinFeatures"
      layout="fill"
    >
      <ProteinFeatureResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

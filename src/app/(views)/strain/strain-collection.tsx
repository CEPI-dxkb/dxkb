"use client";

import { GitBranch } from "lucide-react";
import { EntityViewShell, StrainResourceCollection } from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface StrainCollectionProps {
  initialState: CollectionState;
}

export function StrainCollection({ initialState }: StrainCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Strain View"
      title="Strains"
      tabs={[{ key: "strain", label: "Strains", icon: <GitBranch /> }]}
      activeTab="strain"
      defaultTab="strain"
      layout="fill"
    >
      <StrainResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

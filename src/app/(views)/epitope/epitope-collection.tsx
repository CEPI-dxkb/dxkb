"use client";

import { Activity } from "lucide-react";
import { EntityViewShell, EpitopeResourceCollection } from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface EpitopeCollectionProps {
  initialState: CollectionState;
}

export function EpitopeCollection({ initialState }: EpitopeCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Epitope View"
      title="Epitopes"
      tabs={[{ key: "epitopes", label: "Epitopes", icon: <Activity /> }]}
      activeTab="epitopes"
      defaultTab="epitopes"
      layout="fill"
    >
      <EpitopeResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

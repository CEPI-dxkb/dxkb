"use client";

import { Shapes } from "lucide-react";
import {
  EntityViewShell,
  ProteinStructureResourceCollection,
} from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface ProteinStructureCollectionProps {
  initialState: CollectionState;
}

export function ProteinStructureCollection({
  initialState,
}: ProteinStructureCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Protein Structure View"
      title="Protein Structures"
      tabs={[
        { key: "structures", label: "Protein Structures", icon: <Shapes /> },
      ]}
      activeTab="structures"
      defaultTab="structures"
      layout="fill"
    >
      <ProteinStructureResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

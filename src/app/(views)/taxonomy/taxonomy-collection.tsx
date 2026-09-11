"use client";

import { Binary } from "lucide-react";
import { EntityViewShell, TaxonomyResourceCollection } from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface TaxonomyCollectionProps {
  initialState: CollectionState;
}

export function TaxonomyCollection({ initialState }: TaxonomyCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Taxonomy View"
      title="Taxa"
      tabs={[{ key: "taxons", label: "Taxa", icon: <Binary /> }]}
      activeTab="taxons"
      defaultTab="taxons"
      layout="fill"
    >
      <TaxonomyResourceCollection initialState={initialState} />
    </EntityViewShell>
  );
}

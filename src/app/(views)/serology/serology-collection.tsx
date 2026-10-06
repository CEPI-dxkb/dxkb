"use client";

import { FlaskConical } from "lucide-react";
import {
  EntityViewShell,
  SerologyResourceCollection,
} from "@/components/views";
import type { CollectionState } from "@/lib/views/collection-state";

interface SerologyCollectionProps {
  initialState: CollectionState;
}

export function SerologyCollection({ initialState }: SerologyCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Serology View"
      title="Serology"
      tabs={[{ key: "serology", label: "Serology", icon: <FlaskConical /> }]}
      activeTab="serology"
      defaultTab="serology"
      layout="fill"
    >
      <SerologyResourceCollection
        initialState={initialState}
        keywordMode="refine"
        serverKeywordMode="exact"
      />
    </EntityViewShell>
  );
}

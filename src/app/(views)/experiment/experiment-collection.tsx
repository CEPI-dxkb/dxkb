"use client";

import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  ExperimentResourceCollection,
} from "@/components/views";
import type { ExperimentCollectionTab } from "@/lib/experiment-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { ExperimentBiosetCollection } from "./experiment-bioset-collection";

interface ExperimentCollectionProps {
  initialState: CollectionState;
  activeTab: ExperimentCollectionTab;
}

export function ExperimentCollection({
  initialState,
  activeTab,
}: ExperimentCollectionProps) {
  return (
    <EntityViewShell
      viewLabel="Experiment View"
      title="Experiments"
      tabs={[
        { key: "experiments", label: "Experiments", icon: viewIcons.experiments },
        { key: "biosets", label: "Biosets", icon: viewIcons.biosets },
      ]}
      activeTab={activeTab}
      defaultTab="experiments"
      layout="fill"
    >
      {activeTab === "biosets" ? (
        <ExperimentBiosetCollection experimentState={initialState} />
      ) : (
        <ExperimentResourceCollection
          initialState={initialState}
          keywordMode="refine"
          serverKeywordMode="exact"
        />
      )}
    </EntityViewShell>
  );
}

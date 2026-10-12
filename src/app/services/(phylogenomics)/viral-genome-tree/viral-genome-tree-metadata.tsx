"use client";

import { TreeMetadataOptions } from "@/components/services/tree-metadata-options";
import type { ViralGenomeTreeController } from "./use-viral-genome-tree";

export function ViralGenomeTreeMetadata({
  controller,
}: {
  controller: ViralGenomeTreeController;
}) {
  return (
    <TreeMetadataOptions
      open={controller.showAdvanced}
      onOpenChange={controller.setShowAdvanced}
      sections={controller.metadataSections}
      selectedField={controller.selectedMetadataField}
      onSelectField={controller.handleMetadataSelection}
      onAdd={controller.addMetadataField}
      fields={controller.selectedMetadataFields}
      onRemove={controller.removeMetadataField}
    />
  );
}

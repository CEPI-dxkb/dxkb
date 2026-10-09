"use client";

import { TreeMetadataOptions } from "@/components/services/tree-metadata-options";
import type { GeneProteinTreeController } from "./use-gene-protein-tree";

export function GeneProteinTreeMetadata({
  controller,
}: {
  controller: GeneProteinTreeController;
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

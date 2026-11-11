import type { ReactNode } from "react";

import { viewIcons } from "@/components/views/view-icons";

const typeIcons: Readonly<Record<string, ReactNode>> = {
  taxonomy: viewIcons.taxonomy,
  genome: viewIcons.genomes,
  strain: viewIcons.strains,
  genome_feature: viewIcons.features,
  protein_feature: viewIcons.domainsAndMotifs,
  epitope: viewIcons.epitopes,
  protein_structure: viewIcons.proteinStructures,
  surveillance: viewIcons.surveillance,
  serology: viewIcons.serology,
  experiment: viewIcons.experiments,
};

export function searchTypeIcon(id: string): ReactNode {
  return typeIcons[id] ?? viewIcons.features;
}

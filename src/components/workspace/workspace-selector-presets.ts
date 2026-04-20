/**
 * Type presets for `WorkspaceObjectSelector`. Service pages should use these
 * instead of passing raw type arrays.
 */

import type { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";

export const workspaceSelectorPresets: Record<
  string,
  ValidWorkspaceObjectTypes[]
> = {
  reads: ["reads"],
  folder: ["folder"],
  unspecified: ["unspecified"],
  tsv: ["tsv"],
  contigs: ["contigs"],
  fasta: [
    "contigs",
    "aligned_dna_fasta",
    "aligned_protein_fasta",
    "feature_dna_fasta",
    "feature_protein_fasta",
  ],
  geneSetFasta: [
    "aligned_dna_fasta",
    "aligned_protein_fasta",
    "feature_dna_fasta",
    "feature_protein_fasta",
  ],
  alignedDnaFasta: ["aligned_dna_fasta"],
  alignedProteinFasta: ["aligned_protein_fasta"],
  alignedDnaFastaOrContigs: ["aligned_dna_fasta", "contigs"],
  alignedFasta: ["aligned_protein_fasta", "aligned_dna_fasta"],
  featureFasta: ["feature_protein_fasta", "feature_dna_fasta"],
  featureDnaFasta: ["feature_dna_fasta"],
  featureDnaFastaOrContigs: ["feature_dna_fasta", "contigs"],
  featureProteinFasta: ["feature_protein_fasta"],
  featureProteinFastaOrContigs: ["feature_protein_fasta", "contigs"],
  contigsOrReads: ["contigs", "reads"],
  genomeGroup: ["genome_group"],
  featureGroup: ["feature_group"],
};

export type WorkspaceSelectorPreset = keyof typeof workspaceSelectorPresets;

export function resolveSelectorPreset(
  preset: WorkspaceSelectorPreset,
): ValidWorkspaceObjectTypes[] {
  return workspaceSelectorPresets[preset] ?? [];
}

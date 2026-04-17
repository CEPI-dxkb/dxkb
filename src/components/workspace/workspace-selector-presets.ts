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
  fasta: [
    "contigs",
    "aligned_dna_fasta",
    "aligned_protein_fasta",
    "feature_dna_fasta",
    "feature_protein_fasta",
  ],
  genomeGroup: ["genome_group"],
  featureGroup: ["feature_group"],
  experimentGroup: ["experiment_group"],
};

export type WorkspaceSelectorPreset = keyof typeof workspaceSelectorPresets;

export function resolveSelectorPreset(
  preset: WorkspaceSelectorPreset,
): ValidWorkspaceObjectTypes[] {
  return workspaceSelectorPresets[preset] ?? [];
}

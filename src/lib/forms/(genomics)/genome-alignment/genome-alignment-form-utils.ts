import { GenomeAlignmentFormData } from "./genome-alignment-form-schema";
import type { GenomeSummary } from "@/lib/services/genome";

export function transformGenomeAlignmentParams(
  data: GenomeAlignmentFormData,
) {
  const params: Record<string, unknown> = {
    genome_ids: data.genome_ids,
    recipe: data.recipe,
    output_path: data.output_path,
    output_file: data.output_file,
  };

  params.seedWeight = data.manual_seed_weight ? data.seed_weight ?? null : null;

  if (data.weight !== undefined) {
    params.weight = data.weight;
  }

  return params;
}

export function createGenomeAlignmentFormValues(
  currentValues: GenomeAlignmentFormData,
  overrides: Partial<GenomeAlignmentFormData>,
): GenomeAlignmentFormData {
  return {
    ...currentValues,
    ...overrides,
  };
}

/** A genome a rerun restored by ID alone, because its record did not load. */
export function idOnlyGenome(genomeId: string): GenomeSummary {
  return { genome_id: genomeId, genome_name: genomeId };
}

/** Restored genomes whose names could not be confirmed (lookup failed or omitted these IDs). */
export interface UnverifiedGenomes {
  ids: string[];
  error: string | null;
}

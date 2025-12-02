import {
  type SimilarGenomeFinderFormData,
  DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
} from "./similar-genome-finder-form-schema";

/**
 * Transform similar genome finder form data to the format expected by the backend service
 * Based on the original Dojo implementation which calls:
 * - Minhash.compute_genome_distance_for_genome2 (for genome ID)
 * - Minhash.compute_genome_distance_for_fasta2 (for FASTA file)
 */
export function transformSimilarGenomeFinderParams(
  data: SimilarGenomeFinderFormData,
): Record<string, any> {
  const params: Record<string, any> = {
    max_pvalue: data.max_pvalue,
    max_distance: data.max_distance,
    max_hits: data.max_hits,
    include_bacterial: data.include_bacterial ? 1 : 0,
    include_viral: data.include_viral ? 1 : 0,
  };

  // Add output fields if provided
  if (data.output_path) {
    params.output_path = data.output_path.trim();
  }
  if (data.output_file) {
    params.output_file = data.output_file.trim();
  }

  // Determine include_reference and include_representative based on scope
  // If scope is "reference" and scope_all is false (i.e., scope === "reference"), 
  // then include_reference = 1 and include_representative = 1
  // Otherwise, both are 0
  if (data.scope === "reference") {
    params.include_reference = 1;
    params.include_representative = 1;
  } else {
    params.include_reference = 0;
    params.include_representative = 0;
  }

  // Add input-specific field - check which one has a value
  const hasGenomeId = data.selectedGenomeId.trim().length > 0;
  const hasFastaFile = data.fasta_file.trim().length > 0;

  if (hasGenomeId) {
    params.selectedGenomeId = data.selectedGenomeId.trim();
  }
  if (hasFastaFile) {
    params.fasta_file = data.fasta_file.trim();
  }

  return params;
}

/**
 * Reset form values to defaults
 */
export function resetSimilarGenomeFinderValues(): SimilarGenomeFinderFormData {
  return { ...DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES };
}


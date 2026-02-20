import {
  type SimilarGenomeFinderFormData,
  DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
} from "./similar-genome-finder-form-schema";

/** JSON-RPC payload for https://p3.theseed.org/services/minhash_service */
export interface MinhashServicePayload {
  method:
    | "Minhash.compute_genome_distance_for_genome2"
    | "Minhash.compute_genome_distance_for_fasta2";
  params: [
    string, // genome_id or path
    number, // max_pvalue
    number, // max_distance
    number, // max_hits
    number, // include_reference
    number, // include_representative
    number, // include_bacterial
    number, // include_viral
  ];
  version: string;
  id: string;
}

/**
 * Builds the JSON-RPC payload for the Minhash service at
 * https://p3.theseed.org/services/minhash_service.
 * Params order: [input, max_pvalue, max_distance, max_hits, include_reference,
 * include_representative, include_bacterial, include_viral].
 */
export function buildMinhashServicePayload(
  data: SimilarGenomeFinderFormData,
  id: string = `${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
): MinhashServicePayload {
  const hasGenomeId = data.selectedGenomeId.trim().length > 0;
  const input = hasGenomeId
    ? data.selectedGenomeId.trim()
    : data.fasta_file.trim();

  const includeReference = data.scope === "reference" ? 1 : 0;
  const includeRepresentative = data.scope === "reference" ? 1 : 0;
  const includeBacterial = data.include_bacterial ? 1 : 0;
  const includeViral = data.include_viral ? 1 : 0;

  const method = hasGenomeId
    ? "Minhash.compute_genome_distance_for_genome2"
    : "Minhash.compute_genome_distance_for_fasta2";

  return {
    method,
    params: [
      input,
      data.max_pvalue,
      data.max_distance,
      data.max_hits,
      includeReference,
      includeRepresentative,
      includeBacterial,
      includeViral,
    ],
    version: "1.1",
    id,
  };
}

/**
 * Transforms Similar Genome Finder form data into a flat params object
 * (for debug dialog / legacy compatibility). For actual submission use
 * buildMinhashServicePayload and POST to the Minhash service.
 */
export function transformSimilarGenomeFinderParams(
  data: SimilarGenomeFinderFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    max_pvalue: data.max_pvalue,
    max_distance: data.max_distance,
    max_hits: data.max_hits,
    include_bacterial: data.include_bacterial ? 1 : 0,
    include_viral: data.include_viral ? 1 : 0,
  };

  if (data.output_path?.trim()) {
    params.output_path = data.output_path.trim();
  }
  if (data.output_file?.trim()) {
    params.output_file = data.output_file.trim();
  }

  if (data.scope === "reference") {
    params.include_reference = 1;
    params.include_representative = 1;
  } else {
    params.include_reference = 0;
    params.include_representative = 0;
  }

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


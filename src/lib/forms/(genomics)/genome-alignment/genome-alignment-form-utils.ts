import { GenomeAlignmentFormData } from "./genome-alignment-form-schema";

/**
 * Transform genome alignment form data into the payload expected by the App Service
 */
export function transformGenomeAlignmentParams(
  data: GenomeAlignmentFormData,
) {
  const params: Record<string, any> = {
    genome_ids: data.genome_ids,
    recipe: data.recipe,
    output_path: data.output_path,
    output_file: data.output_file,
  };

  params.seedWeight = data.manual_seed_weight ? data.seed_weight ?? null : null;

  if (data.weight !== undefined && data.weight !== null) {
    params.weight = data.weight;
  }

  return params;
}

/**
 * Helper to create genome alignment form values with overrides
 */
export function createGenomeAlignmentFormValues(
  currentValues: GenomeAlignmentFormData,
  overrides: Partial<GenomeAlignmentFormData>,
): GenomeAlignmentFormData {
  return {
    ...currentValues,
    ...overrides,
  };
}

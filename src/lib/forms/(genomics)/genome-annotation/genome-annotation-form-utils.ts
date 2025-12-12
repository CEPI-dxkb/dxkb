import { GenomeAnnotationFormData } from "./genome-annotation-form-schema";

/**
 * Transform genome annotation form data to API parameters
 */
export function transformGenomeAnnotationParams(
  data: GenomeAnnotationFormData,
): Record<string, any> {
  return {
    contigs: data.contigs,
    recipe: data.recipe,
    scientific_name: data.scientific_name || "",
    taxonomy_id: data.taxonomy_id || "",
    my_label: data.my_label,
    output_file: data.output_file,
    output_path: data.output_path,
  };
}

/**
 * Create genome annotation form values with overrides
 */
export function createGenomeAnnotationFormValues(
  currentValues: GenomeAnnotationFormData,
  overrides: Partial<GenomeAnnotationFormData>,
): GenomeAnnotationFormData {
  return {
    ...currentValues,
    ...overrides,
  };
}

/**
 * Generate output file name based on taxonomy name and user label
 */
export function generateOutputFileName(
  scientificName: string | null,
  myLabel: string,
): string {
  const parts: string[] = [];

  if (scientificName) {
    // Extract the last part of the scientific name (genus/species)
    const nameParts = scientificName.split(" ");
    if (nameParts.length > 0) {
      parts.push(nameParts[nameParts.length - 1].replace(/[()|/:]/g, ""));
    }
  }

  if (myLabel) {
    parts.push(myLabel);
  }

  return parts.join(" ");
}

/**
 * Validate that my label doesn't contain slashes
 */
export function validateMyLabel(myLabel: string): {
  isValid: boolean;
  message: string;
} {
  if (myLabel.includes("/") || myLabel.includes("\\")) {
    return { isValid: false, message: "Slashes are not allowed in My Label" };
  }
  return { isValid: true, message: "" };
}

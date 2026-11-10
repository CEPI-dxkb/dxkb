import { GenomeAnnotationFormData } from "./genome-annotation-form-schema";

export const genomeAnnotationRecipes = [
  { value: "default", label: "Bacteria / Archaea" },
  { value: "viral", label: "Viruses - VIGOR4 annotation" },
  { value: "viral-lowvan", label: "Viruses - Lowvan annotation" },
  { value: "phage", label: "Bacteriophages" },
];

export function transformGenomeAnnotationParams(
  data: GenomeAnnotationFormData,
): Record<string, unknown> {
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

export function createGenomeAnnotationFormValues(
  currentValues: GenomeAnnotationFormData,
  overrides: Partial<GenomeAnnotationFormData>,
): GenomeAnnotationFormData {
  return {
    ...currentValues,
    ...overrides,
  };
}

export function generateOutputFileName(
  scientificName: string | null,
  myLabel: string,
): string {
  const parts: string[] = [];

  if (scientificName) {
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

export function validateMyLabel(myLabel: string): {
  isValid: boolean;
  message: string;
} {
  if (myLabel.includes("/") || myLabel.includes("\\")) {
    return { isValid: false, message: "Slashes are not allowed in My Label" };
  }
  return { isValid: true, message: "" };
}

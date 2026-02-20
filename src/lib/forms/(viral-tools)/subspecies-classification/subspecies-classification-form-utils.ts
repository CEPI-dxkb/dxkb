import type { SubspeciesClassificationFormData } from "./subspecies-classification-form-schema";
import { validateFasta } from "@/lib/fasta-validation";
import type { FastaValidationResult } from "@/lib/fasta-validation";

const programName = "Subspecies Classification";

/**
 * Validate FASTA text for subspecies classification (nucleotide sequences).
 * Returns the full FastaValidationResult; use getSubspeciesFastaMessage for display.
 */
export function validateSubspeciesFasta(fastaText: string): FastaValidationResult {
  return validateFasta(fastaText, "dna");
}

/**
 * Get user-facing message for subspecies FASTA validation (legacy: "Subspecies Classification requires nucleotide sequences. ..." when need_dna).
 */
export function getSubspeciesFastaMessage(result: FastaValidationResult): string {
  if (result.status === "need_dna") {
    return `${programName} requires nucleotide sequences. ${result.message}`;
  }
  return result.message;
}

/**
 * Transform Subspecies Classification form data to API parameters (SubspeciesClassification service).
 */
export function transformSubspeciesClassificationParams(
  data: SubspeciesClassificationFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    input_source: data.input_source,
    virus_type: data.virus_type.trim(),
    output_path: data.output_path.trim(),
    output_file: data.output_file.trim(),
  };

  if (data.input_source === "fasta_data") {
    params.input_fasta_data = (data.input_fasta_data ?? "").trim();
  } else if (data.input_source === "fasta_file") {
    const file = (data.input_fasta_file ?? "").trim();
    params.input_fasta_file = file;
  }

  return params;
}

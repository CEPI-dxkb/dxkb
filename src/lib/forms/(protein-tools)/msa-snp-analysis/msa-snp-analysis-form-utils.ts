import type { MsaSnpAnalysisFormData, FastaFileItem } from "./msa-snp-analysis-form-schema";
import * as MsaSnpAnalysisSchema from "./msa-snp-analysis-form-schema";
import { validateFasta, type FastaValidationResult } from "@/lib/fasta-validation";

export const msaSNPAnalysisAligners = [
  { value: "Mafft", label: "Mafft" },
  { value: "Muscle", label: "Muscle" },
];

// Utility functions
export function getFastaFileTypeLabel(type: FastaFileItem["type"]): string {
  if (type === "feature_protein_fasta") return "Protein FASTA";
  if (type === "feature_dna_fasta") return "DNA FASTA";
  if (type === "aligned_protein_fasta") return "Aligned Protein FASTA";
  if (type === "aligned_dna_fasta") return "Aligned DNA FASTA";
  return type;
}

export function getDisplayName(name: string): string {
  const maxName = 36;
  if (name.length <= maxName) return name;
  return `${name.slice(0, maxName / 2 - 2)}...${name.slice(
    name.length - (maxName / 2) + 2,
  )}`;
}

/**
 * Check if a FASTA file with the given path and type already exists
 */
export function checkDuplicateFastaFile(
  fastaFiles: FastaFileItem[],
  file: string,
  type: FastaFileItem["type"],
): boolean {
  return fastaFiles.some((f) => f.file === file && f.type === type);
}

/**
 * Check if the FASTA file limit has been reached
 */
export function checkFastaFileLimit(fastaFiles: FastaFileItem[]): boolean {
  // No specific limit, but we can add one if needed
  return false;
}

/**
 * Remove a FASTA file at the given index
 */
export function removeFastaFileAtIndex(
  fastaFiles: FastaFileItem[],
  index: number,
): FastaFileItem[] {
  return fastaFiles.filter((_, i) => i !== index);
}

/**
 * Create a new FASTA file item
 */
export function createFastaFileItem(
  file: string,
  type: FastaFileItem["type"],
): FastaFileItem {
  return { file, type };
}

/**
 * Validate FASTA text input for sequences
 * Returns validation result with minimum sequence count check
 */
export function validateSequenceFasta(
  fastaText: string,
  hasReference: boolean = false,
): FastaValidationResult & { meetsMinSequenceRequirement: boolean } {
  const minSeqs = hasReference
    ? MsaSnpAnalysisSchema.MIN_SEQUENCES_WITH_REF
    : MsaSnpAnalysisSchema.MIN_SEQUENCES;

  const result = validateFasta(fastaText, "aa"); // Default to protein, will auto-detect

  return {
    ...result,
    meetsMinSequenceRequirement: result.valid && result.numseq >= minSeqs,
  };
}

/**
 * Validate FASTA text input for reference sequence
 * Must be exactly one sequence
 */
export function validateReferenceFasta(
  fastaText: string,
): FastaValidationResult & { isSingleSequence: boolean } {
  const result = validateFasta(fastaText, "aa"); // Default to protein, will auto-detect

  return {
    ...result,
    isSingleSequence: result.valid && result.numseq === 1,
  };
}

/**
 * Transform MSA SNP Analysis form data to API parameters
 */
export function transformMsaSnpAnalysisParams(
  data: MsaSnpAnalysisFormData,
): Record<string, any> {
  const params: Record<string, any> = {
    input_status: data.input_status,
    aligner: data.aligner,
    output_path: data.output_path,
    output_file: data.output_file.trim(),
  };

  // Add input type and related fields for unaligned sequences
  if (data.input_status === "unaligned" && data.input_type) {
    // Map new internal values to legacy API parameter names
    if (data.input_type === "input_feature_group") {
      params.input_type = "input_group";
      if (data.feature_groups && data.feature_groups.trim() !== "") {
        params.feature_groups = [data.feature_groups];
      }
      // Set alphabet for feature groups - this must be set before fallback logic
      if (data.alphabet) {
        params.alphabet = data.alphabet;
      }
    } else if (data.input_type === "input_genome_group") {
      params.input_type = "input_genomegroup";
      if (data.select_genomegroup && data.select_genomegroup.length > 0) {
        params.select_genomegroup = data.select_genomegroup;
      }
    } else {
      // For other input types, use as-is
      params.input_type = data.input_type;
      if (data.input_type === "input_fasta") {
        if (data.fasta_files && data.fasta_files.length > 0) {
          params.fasta_files = data.fasta_files;
        }
      } else if (data.input_type === "input_sequence") {
        if (data.fasta_keyboard_input) {
          params.fasta_keyboard_input = data.fasta_keyboard_input.trim();
        }
      }
    }
  } else if (data.input_status === "aligned") {
    // For aligned sequences, only fasta_files is needed
    if (data.fasta_files && data.fasta_files.length > 0) {
      params.fasta_files = data.fasta_files;
    }
  }

  // Add reference information
  params.ref_type = data.ref_type;
  if (data.ref_string && data.ref_string.trim() !== "") {
    params.ref_string = data.ref_string.trim();
  }

  // Add strategy only for Mafft (legacy API expects both strategy and strategy_settings)
  if (data.aligner === "Mafft" && data.strategy) {
    params.strategy = data.strategy;
    params.strategy_settings = data.strategy;
  }

  // Set alphabet if not already set (for aligned sequences or when auto-detected)
  // This fallback should NOT override alphabet for feature groups (already set above)
  if (!params.alphabet) {
    // Try to detect from fasta_files if available
    if (data.fasta_files && data.fasta_files.length > 0) {
      const firstFile = data.fasta_files[0];
      if (firstFile.type.includes("protein")) {
        params.alphabet = "protein";
      } else {
        params.alphabet = "dna";
      }
    } else if (data.fasta_keyboard_input) {
      // Auto-detect from keyboard input
      const validation = validateFasta(data.fasta_keyboard_input, "aa");
      params.alphabet = validation.status === "valid_protein" ? "protein" : "dna";
    } else {
      // Default to dna only if no other source
      params.alphabet = "dna";
    }
  }

  return params;
}

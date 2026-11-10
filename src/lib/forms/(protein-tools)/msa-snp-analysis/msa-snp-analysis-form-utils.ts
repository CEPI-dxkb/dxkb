import type { MsaSnpAnalysisFormData, FastaFileItem } from "./msa-snp-analysis-form-schema";
import * as MsaSnpAnalysisSchema from "./msa-snp-analysis-form-schema";
import { validateFasta, type FastaValidationResult } from "@/lib/fasta-validation";

export const msaSNPAnalysisAligners = [
  { value: "Mafft", label: "Mafft" },
  { value: "Muscle", label: "Muscle" },
];

export function getFastaFileTypeLabel(type: string): string {
  if (type === "feature_protein_fasta") return "Protein FASTA";
  if (type === "feature_dna_fasta") return "DNA FASTA";
  if (type === "aligned_protein_fasta") return "Aligned Protein FASTA";
  if (type === "aligned_dna_fasta") return "Aligned DNA FASTA";
  return type; // passthrough for unknown types (e.g. in tests)
}

export function getDisplayName(name: string): string {
  const maxName = 36;
  if (name.length <= maxName) return name;
  return `${name.slice(0, maxName / 2 - 2)}...${name.slice(
    name.length - (maxName / 2) + 2,
  )}`;
}

export function checkDuplicateFastaFile(
  fastaFiles: FastaFileItem[],
  file: string,
  type: FastaFileItem["type"],
): boolean {
  return fastaFiles.some((f) => f.file === file && f.type === type);
}

export function checkFastaFileLimit(_fastaFiles: FastaFileItem[]): boolean {
  return false;
}

export function removeFastaFileAtIndex(
  fastaFiles: FastaFileItem[],
  index: number,
): FastaFileItem[] {
  return fastaFiles.filter((_, i) => i !== index);
}

export function createFastaFileItem(
  file: string,
  type: FastaFileItem["type"],
): FastaFileItem {
  return { file, type };
}

/** Anything but protein is DNA: the picker offers only the kind's two types. */
export function fastaFileFromObject(
  { path, type }: { path: string; type: string },
  kind: "feature" | "aligned",
): FastaFileItem {
  const isProtein = type === `${kind}_protein_fasta`;
  return createFastaFileItem(
    path,
    `${kind}_${isProtein ? "protein" : "dna"}_fasta`,
  );
}

export function validateSequenceFasta(
  fastaText: string,
  hasReference = false,
): FastaValidationResult & { meetsMinSequenceRequirement: boolean } {
  const minSeqs = hasReference
    ? MsaSnpAnalysisSchema.minSequencesWithRef
    : MsaSnpAnalysisSchema.minSequences;

  const result = validateFasta(fastaText, "aa");

  return {
    ...result,
    meetsMinSequenceRequirement: result.valid && result.numseq >= minSeqs,
  };
}

export function validateReferenceFasta(
  fastaText: string,
): FastaValidationResult & { isSingleSequence: boolean } {
  const result = validateFasta(fastaText, "aa");

  return {
    ...result,
    isSingleSequence: result.valid && result.numseq === 1,
  };
}

export function transformMsaSnpAnalysisParams(
  data: MsaSnpAnalysisFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    input_status: data.input_status,
    output_path: data.output_path,
    output_file: data.output_file.trim(),
  };

  if (data.input_status === "unaligned" && data.input_type) {
    // An aligned file is not realigned, so only unaligned input names an aligner.
    params.aligner = data.aligner;
    if (data.aligner === "Mafft" && data.strategy) {
      // Legacy API expects both strategy and strategy_settings
      params.strategy = data.strategy;
      params.strategy_settings = data.strategy;
    }
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
      params.input_type = data.input_type;
      if (data.input_type === "input_fasta") {
        if (data.fasta_files && data.fasta_files.length > 0) {
          params.fasta_files = data.fasta_files;
        }
      } else {
        if (data.fasta_keyboard_input) {
          params.fasta_keyboard_input = data.fasta_keyboard_input.trim();
        }
      }
    }
  } else {
    if (data.fasta_files && data.fasta_files.length > 0) {
      params.fasta_files = data.fasta_files;
    }
  }

  params.ref_type = data.ref_type;
  if (data.ref_string && data.ref_string.trim() !== "") {
    params.ref_string = data.ref_string.trim();
  }

  // Must not override the alphabet already set for feature groups.
  if (!params.alphabet) {
    if (data.fasta_files && data.fasta_files.length > 0) {
      const firstFile = data.fasta_files[0];
      if (firstFile.type.includes("protein")) {
        params.alphabet = "protein";
      } else {
        params.alphabet = "dna";
      }
    } else if (data.fasta_keyboard_input) {
      const validation = validateFasta(data.fasta_keyboard_input, "aa");
      params.alphabet = validation.status === "valid_protein" ? "protein" : "dna";
    } else {
      params.alphabet = "dna";
    }
  }

  return params;
}

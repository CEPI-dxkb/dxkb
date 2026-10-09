import type {
  GeneProteinTreeFormData,
  SequenceItem,
} from "./gene-protein-tree-form-schema";
import * as GeneProteinTreeSchema from "./gene-protein-tree-form-schema";

// Types
export type Alphabet = "DNA" | "Protein";

// Utility functions
export function getDisplayName(name: string): string {
  const maxName = 36;
  if (name.length <= maxName) return name;
  return `${name.slice(0, maxName / 2 - 2)}...${name.slice(
    name.length - maxName / 2 + 2,
  )}`;
}

export function getSequenceTypeLabel(
  type: SequenceItem["type"],
  alphabet: Alphabet,
): string {
  if (type === "feature_group") return "Feature Group";
  if (type === "aligned_dna_fasta" || type === "aligned_protein_fasta") {
    return `${alphabet} Aligned FASTA`;
  }
  return `${alphabet} Unaligned FASTA`;
}

/**
 * Check if a sequence with the given filename and type already exists
 */
export function checkDuplicateSequence(
  sequences: SequenceItem[],
  filename: string,
  type: SequenceItem["type"],
): boolean {
  return sequences.some(
    (seq) => seq.filename === filename && seq.type === type,
  );
}

/**
 * Check if the sequence limit has been reached
 */
export function checkSequenceLimit(sequences: SequenceItem[]): boolean {
  return sequences.length >= GeneProteinTreeSchema.maxSequences;
}

/**
 * Remove a sequence at the given index
 */
export function removeSequenceAtIndex(
  sequences: SequenceItem[],
  index: number,
): SequenceItem[] {
  return sequences.filter((_, i) => i !== index);
}

/**
 * Create a new sequence item
 */
export function createSequenceItem(
  filename: string,
  type: SequenceItem["type"],
): SequenceItem {
  return { filename, type };
}

/**
 * Transform gene/protein tree form data to API parameters
 */
export function transformGeneProteinTreeParams(
  data: GeneProteinTreeFormData,
): Record<string, unknown> {
  // Metadata Options offers genome fields only (legacy's list), so every
  // pick is a genome field. `feature_metadata_fields` stays unset: the app
  // then keeps its gene labels (product, accession, patric_id), which any
  // value given there would replace.
  const metadataFields = data.metadata_fields || [];

  return {
    alphabet: data.alphabet, // API expects "DNA" or "Protein" (uppercase)
    tree_type: "gene",
    recipe: data.recipe,
    substitution_model: data.substitution_model,
    trim_threshold: parseFloat(data.trim_threshold) || 0,
    gap_threshold: parseFloat(data.gap_threshold) || 0,
    sequences: data.sequences.map((seq) => ({
      filename: seq.filename,
      type: seq.type,
    })),
    ...(metadataFields.length > 0 && {
      genome_metadata_fields: metadataFields,
    }),
    output_path: data.output_path,
    output_file: data.output_file.trim(),
  };
}

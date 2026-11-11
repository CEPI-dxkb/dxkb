import type {
  GeneProteinTreeFormData,
  SequenceItem,
} from "./gene-protein-tree-form-schema";
import * as GeneProteinTreeSchema from "./gene-protein-tree-form-schema";

export type Alphabet = "DNA" | "Protein";

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

export function checkDuplicateSequence(
  sequences: SequenceItem[],
  filename: string,
  type: SequenceItem["type"],
): boolean {
  return sequences.some(
    (seq) => seq.filename === filename && seq.type === type,
  );
}

export function checkSequenceLimit(sequences: SequenceItem[]): boolean {
  return sequences.length >= GeneProteinTreeSchema.maxSequences;
}

export function removeSequenceAtIndex(
  sequences: SequenceItem[],
  index: number,
): SequenceItem[] {
  return sequences.filter((_, i) => i !== index);
}

export function createSequenceItem(
  filename: string,
  type: SequenceItem["type"],
): SequenceItem {
  return { filename, type };
}

export function transformGeneProteinTreeParams(
  data: GeneProteinTreeFormData,
): Record<string, unknown> {
  // Metadata Options offers genome fields only; feature_metadata_fields stays unset so the app keeps its gene labels.
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

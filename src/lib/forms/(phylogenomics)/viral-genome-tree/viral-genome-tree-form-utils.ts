import type { ViralGenomeTreeFormData, ViralGenomeSequenceItem } from "./viral-genome-tree-form-schema";
import * as ViralGenomeTreeSchema from "./viral-genome-tree-form-schema";

// Utility functions
export function getDisplayName(name: string): string {
  const maxName = 36;
  if (name.length <= maxName) return name;
  return `${name.slice(0, maxName / 2 - 2)}...${name.slice(
    name.length - (maxName / 2) + 2,
  )}`;
}

export function getSequenceTypeLabel(
  type: ViralGenomeSequenceItem["type"],
): string {
  if (type === "genome_group") return "Genome Group";
  if (type === "aligned_dna_fasta") {
    return "Aligned DNA FASTA";
  }
  return "Unaligned DNA FASTA";
}

/**
 * Check if a sequence with the given filename and type already exists
 */
export function checkDuplicateSequence(
  sequences: ViralGenomeSequenceItem[],
  filename: string,
  type: ViralGenomeSequenceItem["type"],
): boolean {
  return sequences.some((seq) => seq.filename === filename && seq.type === type);
}

/**
 * Check if the sequence limit has been reached
 */
export function checkSequenceLimit(sequences: ViralGenomeSequenceItem[]): boolean {
  return sequences.length >= ViralGenomeTreeSchema.maxSequences;
}

/**
 * Remove a sequence at the given index
 */
export function removeSequenceAtIndex(
  sequences: ViralGenomeSequenceItem[],
  index: number,
): ViralGenomeSequenceItem[] {
  return sequences.filter((_, i) => i !== index);
}

/**
 * Create a new sequence item
 */
export function createSequenceItem(
  filename: string,
  type: ViralGenomeSequenceItem["type"],
): ViralGenomeSequenceItem {
  return { filename, type };
}

/**
 * Transform viral genome tree form data to API parameters
 */
export function transformViralGenomeTreeParams(
  data: ViralGenomeTreeFormData,
): Record<string, unknown> {
  // All metadata fields for viral genome tree are genome-related
  const metadataFields = data.metadata_fields || [];
  
  return {
    alphabet: "DNA",
    tree_type: "viral_genome",
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


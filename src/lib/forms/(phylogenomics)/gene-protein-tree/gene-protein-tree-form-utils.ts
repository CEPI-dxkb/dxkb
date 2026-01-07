import type { GeneProteinTreeFormData, SequenceItem } from "./gene-protein-tree-form-schema";

// Types
export type Alphabet = "DNA" | "Protein";

// Utility functions
export function formatMetadataLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getDisplayName(name: string): string {
  const maxName = 36;
  if (name.length <= maxName) return name;
  return `${name.slice(0, maxName / 2 - 2)}...${name.slice(
    name.length - (maxName / 2) + 2,
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
 * Transform gene/protein tree form data to API parameters
 */
export function transformGeneProteinTreeParams(
  data: GeneProteinTreeFormData,
): Record<string, any> {
  // Split metadata fields into feature and genome fields
  // For now, all current metadata fields appear to be genome-related
  // Feature metadata fields would be things like gene_id, gene_name, etc.
  const metadataFields = data.metadata_fields || [];
  const featureMetadataFields: string[] = [];
  const genomeMetadataFields: string[] = [];
  
  // Common genome metadata fields
  const genomeFields = [
    "genome_id",
    "genome_name",
    "genome_length",
    "species",
    "strain",
    "accession",
    "subtype",
    "lineage",
    "host_group",
    "host_common_name",
    "collection_date",
    "collection_year",
    "geographic_group",
    "isolation_country",
    "geographic_location",
  ];
  
  metadataFields.forEach((field) => {
    if (genomeFields.includes(field)) {
      genomeMetadataFields.push(field);
    } else {
      // Assume other fields are feature-related
      featureMetadataFields.push(field);
    }
  });
  
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
    ...(featureMetadataFields.length > 0 && {
      feature_metadata_fields: featureMetadataFields,
    }),
    ...(genomeMetadataFields.length > 0 && {
      genome_metadata_fields: genomeMetadataFields,
    }),
    output_path: data.output_path,
    output_file: data.output_file.trim(),
  };
}


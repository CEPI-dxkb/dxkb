import type { MetagenomicReadMappingFormData } from "./metagenomic-read-mapping-form-schema";

/**
 * Transform metagenomic read mapping form data to API parameters
 */
export function transformMetagenomicReadMappingParams(
  data: MetagenomicReadMappingFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    gene_set_type: data.gene_set_type, // Include gene_set_type in params
  };

  // Add read libraries
  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => ({
      read1: lib.read1,
      read2: lib.read2,
    }));
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => ({
      read: lib.read,
    }));
  }

  if (data.srr_ids && data.srr_ids.length > 0) {
    params.srr_ids = data.srr_ids;
  }

  // Handle gene set based on type
  if (data.gene_set_type === "predefined_list") {
    params.gene_set_name = data.gene_set_name;
  } else if (data.gene_set_type === "fasta_file") {
    params.gene_set_fasta = data.gene_set_fasta;
  } else if (data.gene_set_type === "feature_group") {
    params.gene_set_feature_group = data.gene_set_feature_group;
  }

  return params;
}

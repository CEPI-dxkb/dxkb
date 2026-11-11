import type { TaxonomicClassificationFormData } from "./taxonomic-classification-form-schema";

export function transformTaxonomicClassificationParams(
  data: TaxonomicClassificationFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    sequence_type: data.sequence_type === "16s" ? "sixteenS" : data.sequence_type,
    database: data.database,
    confidence_interval: data.confidence_interval,
    save_classified_sequences: data.save_classified_sequences ? "true" : "false",
    save_unclassified_sequences: data.save_unclassified_sequences ? "true" : "false",
  };

  // analysis_type and host_genome are only valid for WGS; omit for sixteenS
  if (data.sequence_type === "wgs") {
    params.analysis_type = data.analysis_type;
    params.host_genome = data.host_genome;
  }

  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    // Top-level sample_id from user-editable form field (preserves exact input including hyphens)
    if (data.paired_sample_id?.trim()) {
      params.paired_sample_id = data.paired_sample_id.trim();
    }

    params.paired_end_libs = data.paired_end_libs.map((lib) => ({
      read1: lib.read1,
      read2: lib.read2,
      sample_id: lib.sample_id,
    }));
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    if (data.single_sample_id?.trim()) {
      params.single_sample_id = data.single_sample_id.trim();
    }

    params.single_end_libs = data.single_end_libs.map((lib) => ({
      read: lib.read,
      sample_id: lib.sample_id,
    }));
  }

  if (data.srr_libs && data.srr_libs.length > 0) {
    if (data.srr_sample_id?.trim()) {
      params.srr_sample_id = data.srr_sample_id.trim();
    }

    params.srr_libs = data.srr_libs.map((lib) => ({
      srr_accession: lib.srr_accession,
      sample_id: lib.sample_id,
      ...(lib.title && { title: lib.title }),
    }));
  }

  return params;
}

export function getDefaultAnalysisType(sequenceType: "wgs" | "16s"): string {
  return sequenceType === "wgs" ? "microbiome" : "default";
}

export function getDefaultDatabase(sequenceType: "wgs" | "16s"): string {
  return sequenceType === "wgs" ? "bvbrc" : "SILVA";
}

export function isHostFilteringAvailable(sequenceType: "wgs" | "16s"): boolean {
  return sequenceType === "wgs";
}

export function isAnalysisTypeSelectable(sequenceType: "wgs" | "16s"): boolean {
  return sequenceType === "wgs";
}

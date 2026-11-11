import type { MetagenomicBinningFormData } from "./metagenomic-binning-form-schema";

export function transformMetagenomicBinningParams(
  data: MetagenomicBinningFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
  };

  if (data.genome_group && data.genome_group.trim()) {
    params.genome_group = data.genome_group.trim();
  }

  if (data.start_with === "reads") {
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

    params.assembler = data.assembler;
  } else {
    params.contigs = data.contigs;
  }

  if (data.organism === "bacteria") {
    params.perform_bacterial_annotation = true;
  } else if (data.organism === "viral") {
    params.perform_bacterial_binning = false;
    params.perform_viral_annotation = true;
    params.perform_viral_binning = true;
  } else {
    params.perform_bacterial_annotation = true;
    params.perform_viral_annotation = true;
    params.perform_viral_binning = true;
  }

  params.min_contig_len = data.min_contig_len;
  params.min_contig_cov = data.min_contig_cov;

  if (data.disable_dangling) {
    params.danglen = 0;
  }

  return params;
}
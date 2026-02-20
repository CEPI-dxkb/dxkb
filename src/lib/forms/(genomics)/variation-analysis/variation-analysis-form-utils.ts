import { VariationAnalysisFormData } from "./variation-analysis-form-schema";

export const variationAnalysisMappers = [
  { value: "BWA-mem", label: "BWA-mem" },
  { value: "BWA-mem-strict", label: "BWA-mem-strict" },
  { value: "Bowtie2", label: "Bowtie2" },
  { value: "LAST", label: "LAST" },
  { value: "minimap2", label: "minimap2" },
];

export const variationAnalysisCallers = [
  { value: "FreeBayes", label: "FreeBayes" },
  { value: "BCFtools", label: "BCFtools" },
];

/**
 * Transform variation analysis form data to the format expected by the backend service
 */
export function transformVariationAnalysisParams(data: VariationAnalysisFormData) {
  const params: Record<string, any> = {
    reference_genome_id: data.reference_genome_id,
    mapper: data.mapper,
    caller: data.caller,
    output_path: data.output_path,
    output_file: data.output_file,
  };

  // Add library data
  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => {
      const libData: Record<string, any> = {};

      // Copy all properties except internal ones (starting with _)
      Object.keys(lib).forEach((key) => {
        if (!key.startsWith("_")) {
          libData[key] = lib[key as keyof typeof lib];
        }
      });

      return libData;
    });
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => {
      const libData: Record<string, any> = {};

      Object.keys(lib).forEach((key) => {
        if (!key.startsWith("_")) {
          libData[key] = lib[key as keyof typeof lib];
        }
      });

      return libData;
    });
  }

  if (data.srr_ids && data.srr_ids.length > 0) {
    params.srr_ids = data.srr_ids;
  }

  return params;
}


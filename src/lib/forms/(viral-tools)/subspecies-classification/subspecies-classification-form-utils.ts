import type { SubspeciesClassificationFormData } from "./subspecies-classification-form-schema";

export function transformSubspeciesClassificationParams(
  data: SubspeciesClassificationFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    input_source: data.input_source,
    virus_type: data.virus_type.trim(),
    output_path: data.output_path.trim(),
    output_file: data.output_file.trim(),
  };

  if (data.input_source === "fasta_data") {
    params.input_fasta_data = (data.input_fasta_data ?? "").trim();
  } else {
    const file = (data.input_fasta_file ?? "").trim();
    params.input_fasta_file = file;
  }

  return params;
}

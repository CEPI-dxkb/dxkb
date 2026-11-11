import type { InfluenzaHaSubtypeFormData } from "./influenza-ha-subtype-form-schema";

/** Prepends a default header to a single headerless sequence (legacy behavior). */
function normalizeFastaData(sequence: string): string {
  const trimmed = sequence.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(">")) return trimmed;
  return `>fasta_record1\n${trimmed}`;
}

export function transformHaSubtypeParams(
  data: InfluenzaHaSubtypeFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    input_source: data.input_source,
    output_file: data.output_file.trim(),
    output_path: data.output_path.trim(),
    types: data.types,
  };

  if (data.input_source === "fasta_data") {
    params.input_fasta_data = normalizeFastaData(data.input_fasta_data);
  } else if (data.input_source === "fasta_file") {
    params.input_fasta_file = data.input_fasta_file.trim();
  } else {
    params.input_feature_group = data.input_feature_group.trim();
  }

  return params;
}

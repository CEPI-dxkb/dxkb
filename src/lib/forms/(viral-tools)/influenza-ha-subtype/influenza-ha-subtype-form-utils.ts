import type { InfluenzaHaSubtypeFormData } from "./influenza-ha-subtype-form-schema";

/**
 * Normalize pasted FASTA for submission: if user pasted a single sequence
 * without a header line, prepend a default header (legacy behavior).
 */
function normalizeFastaData(sequence: string): string {
  const trimmed = sequence.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(">")) return trimmed;
  return `>fasta_record1\n${trimmed}`;
}

/**
 * Transform HA Subtype Numbering form data to API submission parameters.
 */
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
  } else if (data.input_source === "feature_group") {
    params.input_feature_group = data.input_feature_group.trim();
  }

  return params;
}

export const strainAccessionUrlTemplate =
  "https://www.ncbi.nlm.nih.gov/nuccore/{value}";

const strainAccessionFields = new Set([
  "genbank_accessions",
  "1_pb2",
  "2_pb1",
  "3_pa",
  "4_ha",
  "5_np",
  "6_na",
  "7_mp",
  "8_ns",
  "s",
  "m",
  "l",
  "other_segments",
]);

export function isStrainAccessionField(field: string): boolean {
  return strainAccessionFields.has(field);
}

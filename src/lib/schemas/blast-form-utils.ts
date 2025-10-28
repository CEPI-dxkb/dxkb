import type { BlastFormData } from "./blast/blast-form-schema";
import { blastPrecomputedDatabases } from "@/types/services";

/**
 * Creates a new form values object by merging current values with overrides
 * Automatically handles all form fields without manual mapping
 */
export function createBlastFormValues(
  currentValues: Partial<BlastFormData>,
  overrides: Partial<BlastFormData>,
): BlastFormData {
  return {
    // Base fields
    input_type: currentValues.input_type || "aa",
    input_source: currentValues.input_source || "fasta_data",
    db_type: currentValues.db_type || "fna",
    db_source: currentValues.db_source || "precomputed_database",
    blast_program: currentValues.blast_program || "blastn",
    output_file: currentValues.output_file || "",
    output_path: currentValues.output_path || "",
    blast_max_hits: currentValues.blast_max_hits || 10,
    blast_evalue_cutoff: currentValues.blast_evalue_cutoff || 0.0001,
    db_precomputed_database:
      currentValues.db_precomputed_database || "bacteria-archaea",

    // Input source fields - handle discriminated union properly
    input_fasta_data: (currentValues as any).input_fasta_data || "",
    input_fasta_file: (currentValues as any).input_fasta_file || "",
    input_feature_group: (currentValues as any).input_feature_group || "",

    // Database conditional fields
    db_genome_list: currentValues.db_genome_list || [],
    db_genome_group: currentValues.db_genome_group || "",
    db_feature_group: currentValues.db_feature_group || "",
    db_taxon_list: currentValues.db_taxon_list || [],
    db_fasta_file: currentValues.db_fasta_file || "",

    // Apply overrides
    ...overrides,
  };
}

/**
 * Creates input source field overrides based on the selected input source
 */
export function createInputSourceOverrides(
  newSource: BlastFormData["input_source"],
  preservedFastaData: string = "",
): Partial<BlastFormData> {
  const baseOverrides: Partial<BlastFormData> = {
    input_source: newSource,
  };

  switch (newSource) {
    case "fasta_data":
      return { ...baseOverrides, input_fasta_data: preservedFastaData };
    case "fasta_file":
      return { ...baseOverrides, input_fasta_file: "" };
    case "feature_group":
      return { ...baseOverrides, input_feature_group: "" };
    default:
      return baseOverrides;
  }
}

/**
 * Creates database field overrides based on the selected database source
 */
export function createDatabaseSourceOverrides(
  newDBPrecomputedDatabase: BlastFormData["db_precomputed_database"],
  preservedInputFields: Partial<BlastFormData>,
): Partial<BlastFormData> {
  const selectedDb = blastPrecomputedDatabases.find(
    (db) => db.value === newDBPrecomputedDatabase,
  );

  if (!selectedDb) {
    throw new Error(`Invalid database source: ${newDBPrecomputedDatabase}`);
  }

  const baseOverrides: Partial<BlastFormData> = {
    ...preservedInputFields,
    db_source: selectedDb.db_source as BlastFormData["db_source"],
    db_precomputed_database: newDBPrecomputedDatabase,
  };

  // Add database-specific field overrides
  switch (newDBPrecomputedDatabase) {
    case "selGenome":
      return { ...baseOverrides, db_genome_list: [] };
    case "selGroup":
      return { ...baseOverrides, db_genome_group: "" };
    case "selFeatureGroup":
      return { ...baseOverrides, db_feature_group: "" };
    case "selTaxon":
      return { ...baseOverrides, db_taxon_list: [] };
    case "selFasta":
      return { ...baseOverrides, db_fasta_file: "" };
    default:
      return baseOverrides;
  }
}

/**
 * Extracts input-related fields from form values for preservation
 */
export function extractInputFields(
  values: Partial<BlastFormData>,
): Partial<BlastFormData> {
  return {
    input_source: values.input_source,
    input_fasta_data: (values as any).input_fasta_data || "",
    input_fasta_file: (values as any).input_fasta_file || "",
    input_feature_group: (values as any).input_feature_group || "",
  };
}

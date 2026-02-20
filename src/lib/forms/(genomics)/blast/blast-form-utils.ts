import type { BlastFormData } from "./blast-form-schema";
import { blastPrecomputedDatabases } from "@/types/services";
import { getDefaultBlastDatabaseType } from "@/lib/services/service-utils";

export const maxHitsOptionsBlast = [
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 500, label: "500" },
  { value: 5000, label: "5000" },
] as const;

/** Options for E-value threshold dropdown */
export const evalueOptionsBlast = [
  { value: 0.0001, label: "0.0001" },
  { value: 0.001, label: "0.001" },
  { value: 0.01, label: "0.01" },
  { value: 0.1, label: "0.1" },
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 100, label: "100" },
  { value: 1000, label: "1000" },
  { value: 10000, label: "10000" },
] as const;

const DB_SOURCE_MAP: Record<
  BlastFormData["db_precomputed_database"],
  BlastFormData["db_source"]
> = {
  "bacteria-archaea": "precomputed_database",
  "viral-reference": "precomputed_database",
  selGenome: "genome_list",
  selGroup: "genome_group",
  selFeatureGroup: "feature_group",
  selTaxon: "taxon_list",
  selFasta: "fasta_file",
};

function resolveInputType(
  program: BlastFormData["blast_program"] | undefined,
  fallback: BlastFormData["input_type"] | undefined,
): BlastFormData["input_type"] {
  if (!program) return fallback || "dna";
  return program === "blastp" || program === "tblastn" ? "aa" : "dna";
}

function resolveDbSource(
  database: BlastFormData["db_precomputed_database"] | undefined,
): BlastFormData["db_source"] {
  return DB_SOURCE_MAP[database || "bacteria-archaea"] || "precomputed_database";
}

/**
 * Creates a new form values object by merging current values with overrides
 * Automatically handles all form fields without manual mapping
 */
export function createBlastFormValues(
  currentValues: Partial<BlastFormData>,
  overrides: Partial<BlastFormData>,
): BlastFormData {
  const blastProgram =
    overrides.blast_program || currentValues.blast_program || "blastn";
  const dbPrecomputedDatabase =
    overrides.db_precomputed_database ||
    currentValues.db_precomputed_database ||
    "bacteria-archaea";
  const derivedDbSource =
    overrides.db_source ||
    resolveDbSource(
      overrides.db_precomputed_database || currentValues.db_precomputed_database,
    );
  const derivedDbType =
    overrides.db_type ||
    currentValues.db_type ||
    (getDefaultBlastDatabaseType(blastProgram, dbPrecomputedDatabase) as BlastFormData["db_type"]);

  return {
    // Base fields
    input_type: resolveInputType(
      overrides.blast_program || currentValues.blast_program,
      currentValues.input_type,
    ),
    input_source: currentValues.input_source || "fasta_data",
    db_type: derivedDbType,
    db_source: derivedDbSource,
    blast_program: blastProgram,
    output_file: currentValues.output_file || "",
    output_path: currentValues.output_path || "",
    blast_max_hits: currentValues.blast_max_hits || 10,
    blast_evalue_cutoff: currentValues.blast_evalue_cutoff || 0.0001,
    db_precomputed_database: dbPrecomputedDatabase,

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
    db_source: resolveDbSource(newDBPrecomputedDatabase),
    db_precomputed_database: newDBPrecomputedDatabase,
    db_genome_list: [],
    db_genome_group: "",
    db_feature_group: "",
    db_taxon_list: [],
    db_fasta_file: "",
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

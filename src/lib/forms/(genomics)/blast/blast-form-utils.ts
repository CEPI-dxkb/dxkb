import { useEffect, useMemo, useState, useCallback } from "react";
import { useStore, type AnyFormApi } from "@tanstack/react-form";

import type { BlastFormData } from "./blast-form-schema";
import { blastPrecomputedDatabases, blastDatabaseTypes, blastDatabaseTypeMap } from "@/types/services";
import { validateFastaForBlast, getBlastFastaErrorMessage } from "@/lib/fasta-validation";
import type { FastaValidationResult } from "@/lib/fasta-validation";

/**
 * Get available database types for BLAST based on the selected program and database source
 */
export function getAvailableBlastDatabaseTypes(
  inputType: string,
  dbSource: string,
) {
  const availableTypes = blastDatabaseTypeMap[inputType]?.[dbSource] || [];
  const filtered = blastDatabaseTypes.filter((dbType) =>
    availableTypes.includes(dbType.value),
  );

  return filtered.length > 0 ? filtered : blastDatabaseTypes;
}

/**
 * Get the default database type for a given BLAST program and database source
 */
export function getDefaultBlastDatabaseType(
  inputType: string,
  dbSource: string,
): string {
  const availableTypes =
    blastDatabaseTypeMap[inputType]?.[dbSource] || blastDatabaseTypes.map((t) => t.value);
  return availableTypes[0] || "fna";
}

/**
 * Validates FASTA input for BLAST services
 */
export function validateBlastFastaInput(
  fastaText: string,
  inputType: "blastn" | "blastp" | "blastx" | "tblastn",
): { isValid: boolean; message: string } {
  if (!fastaText.trim()) {
    return { isValid: false, message: "FASTA input is required" };
  }

  const result = validateFastaForBlast(fastaText, inputType);
  const message = getBlastFastaErrorMessage(result, inputType);

  return {
    isValid: result.valid,
    message: result.valid ? "" : message,
  };
}

/**
 * Transform BLAST form data to API parameters
 */
export function transformBlastParams(data: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = {
    input_type: data.input_type,
    input_source: data.input_source,
    db_type: data.db_type,
    db_source: data.db_source,
    db_precomputed_database: data.db_precomputed_database,
    blast_program: data.blast_program,
    output_file: data.output_file,
    output_path: data.output_path,
    blast_max_hits: data.blast_max_hits,
    blast_evalue_cutoff: String(data.blast_evalue_cutoff),
  };

  if (data.input_source === "fasta_data") {
    params.input_fasta_data = data.input_fasta_data;
  } else if (data.input_source === "fasta_file") {
    params.input_fasta_file = data.input_fasta_file;
  } else if (data.input_source === "feature_group") {
    params.input_feature_group = data.input_feature_group;
  }

  if (data.db_precomputed_database === "selGenome") {
    params.db_genome_list = data.db_genome_list;
  } else if (data.db_precomputed_database === "selGroup") {
    params.db_genome_group = data.db_genome_group;
  } else if (data.db_precomputed_database === "selFeatureGroup") {
    params.db_feature_group = data.db_feature_group;
  } else if (data.db_precomputed_database === "selTaxon") {
    params.db_taxon_list = data.db_taxon_list;
  } else if (data.db_precomputed_database === "selFasta") {
    params.db_fasta_file = data.db_fasta_file;
  }

  return params;
}

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
    input_fasta_data: String((currentValues as Record<string, unknown>).input_fasta_data ?? ""),
    input_fasta_file: String((currentValues as Record<string, unknown>).input_fasta_file ?? ""),
    input_feature_group: String((currentValues as Record<string, unknown>).input_feature_group ?? ""),

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
  preservedFastaData = "",
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
    input_fasta_data: String((values as Record<string, unknown>).input_fasta_data ?? ""),
    input_fasta_file: String((values as Record<string, unknown>).input_fasta_file ?? ""),
    input_feature_group: String((values as Record<string, unknown>).input_feature_group ?? ""),
  };
}

/**
 * Custom hook to manage BLAST database type availability
 */
export function useBlastDatabaseTypes(form: AnyFormApi) {
  const blastProgram = useStore(form.store, (s) => s.values.blast_program);
  const dbPrecomputedDatabase = useStore(form.store, (s) => s.values.db_precomputed_database);
  const dbType = useStore(form.store, (s) => s.values.db_type);

  const availableDatabaseTypes = useMemo(() => {
    if (blastProgram && dbPrecomputedDatabase) {
      return getAvailableBlastDatabaseTypes(blastProgram, dbPrecomputedDatabase);
    }
    return getAvailableBlastDatabaseTypes("blastn", "bacteria-archaea");
  }, [blastProgram, dbPrecomputedDatabase]);

  useEffect(() => {
    if (blastProgram && dbPrecomputedDatabase) {
      const isCurrentTypeAvailable = availableDatabaseTypes.some(
        (type) => type.value === dbType,
      );

      if (!isCurrentTypeAvailable && availableDatabaseTypes.length > 0) {
        const defaultType = getDefaultBlastDatabaseType(
          blastProgram,
          dbPrecomputedDatabase,
        );

        if (defaultType) {
          form.setFieldValue("db_type", defaultType as BlastFormData["db_type"]);
        }
      } else if (availableDatabaseTypes.length > 0 && !dbType) {
        const firstType = availableDatabaseTypes[0].value;
        form.setFieldValue("db_type", firstType as BlastFormData["db_type"]);
      }
    }
  }, [blastProgram, dbPrecomputedDatabase, dbType, form, availableDatabaseTypes]);

  return availableDatabaseTypes;
}

/**
 * Custom hook to track BLAST program changes
 */
export function useBlastProgramTracking(form: AnyFormApi) {
  const currentBlastProgram = useStore(form.store, (s) => s.values.blast_program);
  return currentBlastProgram || "blastn";
}

/**
 * Custom hook to manage FASTA validation
 */
export function useFastaValidation(form: AnyFormApi, currentBlastProgram: BlastFormData["blast_program"]) {
  const [fastaValidationResult, setFastaValidationResult] = useState<FastaValidationResult | null>(null);
  const [isFastaValid, setIsFastaValid] = useState(false);
  const [prevProgram, setPrevProgram] = useState(currentBlastProgram);

  const handleFastaValidationChange = useCallback((isValid: boolean, result: FastaValidationResult | null) => {
    setIsFastaValid(isValid);
    setFastaValidationResult(result);
  }, []);

  if (prevProgram !== currentBlastProgram) {
    setPrevProgram(currentBlastProgram);
    const currentFastaData = form.state.values.input_fasta_data;
    if (currentFastaData && form.state.values.input_source === "fasta_data") {
      const result = validateFastaForBlast(currentFastaData, currentBlastProgram);
      setFastaValidationResult(result);
      setIsFastaValid(result.valid);
    }
  }

  return {
    fastaValidationResult,
    isFastaValid,
    handleFastaValidationChange,
  };
}

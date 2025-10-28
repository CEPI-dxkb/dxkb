import type { FormEvent } from "react";
import {
  Library,
  Genome,
  blastDatabaseTypes,
  blastDatabaseTypeMap,
} from "@/types/services";
import { toast } from "sonner";

export interface FileInput {
  first: string;
  second?: string;
}

export interface PipelineAction {
  id: string;
  name: string;
  color?: string;
  shape?: string;
}

export const pipelineActionList = [
  { id: "trim", name: "Trim" },
  { id: "paired_filter", name: "Paired Filter" },
  { id: "fastqc", name: "FastQC" },
  { id: "align", name: "Align" },
  { id: "scrub_human", name: "Scrub Human" },
] as const;

export const actionColors = [
  "bg-purple-500",
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
] as const;

export const actionShapes = ["circle", "square", "diamond"] as const;

export function handlePairedLibraryAdd(
  files: FileInput,
  currentLibraries: Library[],
  allowDuplicates = false,
): Library[] {
  if (!files.second) return currentLibraries;

  const newName = `${files.first} / ${files.second}`;
  const isDuplicate = currentLibraries.some(
    (lib) => lib.name === newName && lib.type === "paired",
  );

  if (isDuplicate && !allowDuplicates) {
    toast.error("Duplicate library detected", {
      description: "This paired library has already been added.",
      closeButton: true,
    });
    return currentLibraries;
  }

  const newId = Date.now();
  return [
    ...currentLibraries,
    {
      id: `paired-${newId}`,
      name: newName,
      type: "paired",
    },
  ];
}

export function handleSingleLibraryAdd(
  files: FileInput,
  currentLibraries: Library[],
  allowDuplicates = false,
): Library[] {
  const isDuplicate = currentLibraries.some(
    (lib) => lib.name === files.first && lib.type === "single",
  );

  if (isDuplicate && !allowDuplicates) {
    toast.error("Duplicate library detected", {
      description: "This single library has already been added.",
      closeButton: true,
    });
    return currentLibraries;
  }

  const newId = Date.now();
  return [
    ...currentLibraries,
    {
      id: `single-${newId}`,
      name: files.first,
      type: "single",
    },
  ];
}

export function handleSraAdd(
  sraAccession: string,
  currentLibraries: Library[],
  allowDuplicates = false,
): Library[] | null {
  if (!sraAccession.trim()) return null;

  const isDuplicate = currentLibraries.some(
    (lib) => lib.name === sraAccession && lib.type === "sra",
  );

  if (isDuplicate && !allowDuplicates) {
    toast.error("Duplicate SRA accession detected", {
      description: "This SRA accession has already been added.",
      closeButton: true,
    });
    return null;
  }

  return [
    ...currentLibraries,
    {
      id: `sra-${Date.now()}`,
      name: sraAccession,
      type: "sra",
    },
  ];
}

export function removeFromSelectedLibraries(
  id: string,
  selectedLibraries: Library[],
) {
  return selectedLibraries.filter((lib) => lib.id !== id);
}

export function removeFromSelectedGenomes(
  id: string,
  selectedGenomes: Genome[],
) {
  return selectedGenomes.filter((genome) => genome.id !== id);
}

export function removeFromSelectedPipelineActions(
  id: string,
  selectedPipelineActions: PipelineAction[],
): PipelineAction[] {
  return selectedPipelineActions.filter((action) => action.id !== id);
}

export function addGenome(genome: Genome, selectedGenomes: Genome[]) {
  return [...selectedGenomes, genome];
}

export function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
  console.log("Form submitted");
  console.log("Form data:", new FormData(e.currentTarget));
  e.preventDefault();
}

/**
 * Get available database types for BLAST based on the selected program and database source
 * @param inputType - The BLAST program (blastn, blastp, blastx, tblastn)
 * @param dbSource - The database source (bacteria-archaea, viral-reference, selGenome, etc.)
 * @returns Array of available database type options
 */
export function getAvailableBlastDatabaseTypes(
  inputType: string,
  dbSource: string,
) {
  const availableTypes = blastDatabaseTypeMap[inputType]?.[dbSource] || [];

  return blastDatabaseTypes.filter((dbType) =>
    availableTypes.includes(dbType.value),
  );
}

/**
 * Get the default database type for a given BLAST program and database source
 * @param inputType - The BLAST program
 * @param dbSource - The database source
 * @returns The default database type value
 */
export function getDefaultBlastDatabaseType(
  inputType: string,
  dbSource: string,
): string {
  const availableTypes = blastDatabaseTypeMap[inputType]?.[dbSource];
  return availableTypes?.[0] || "fna";
}

/**
 * Validates FASTA input for BLAST services
 */
export function validateBlastFastaInput(
  fastaText: string,
  inputType: "blastn" | "blastp" | "blastx" | "tblastn",
): { isValid: boolean; message: string } {
  const {
    validateFastaForBlast,
    getBlastFastaErrorMessage,
  } = require("../fasta-validation");

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
 * Handles conditional fields based on input_source and db_precomputed_database
 */
export function transformBlastParams(data: Record<string, any>): Record<string, any> {
  const params: Record<string, any> = {
    input_type: data.input_type,
    input_source: data.input_source,
    db_type: data.db_type,
    db_source: data.db_source,
    db_precomputed_database: data.db_precomputed_database,
    blast_program: data.blast_program,
    output_file: data.output_file,
    output_path: data.output_path,
    blast_max_hits: data.blast_max_hits,
    blast_evalue_cutoff: data.blast_evalue_cutoff.toString(),
  };

  // Add input-specific fields
  if (data.input_source === "fasta_data") {
    params.input_fasta_data = data.input_fasta_data;
  } else if (data.input_source === "fasta_file") {
    params.input_fasta_file = data.input_fasta_file;
  } else if (data.input_source === "feature_group") {
    params.input_feature_group = data.input_feature_group;
  }

  // Add database-specific fields
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

/**
 * Generic service submission helper
 * Submits any service job via the workspace API
 */
export async function submitServiceJob(
  appName: string,
  appParams: Record<string, any>,
): Promise<{ success: boolean; job?: any; error?: string }> {
  try {
    const response = await fetch("/api/services/app-service/submit", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_name: appName,
        app_params: appParams,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return { success: true, job: result.job };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to submit service job";
    return { success: false, error: errorMessage };
  }
}



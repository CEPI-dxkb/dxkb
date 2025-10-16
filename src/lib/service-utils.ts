import type { FormEvent } from "react";
import { Library, Genome, blastDatabaseTypes, blastDatabaseTypeMap } from "@/types/services";
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
  selectedPipelineActions: PipelineAction[]
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
 * @param blastProgram - The BLAST program (blastn, blastp, blastx, tblastn)
 * @param dbSource - The database source (bacteria-archaea, viral-reference, selGenome, etc.)
 * @returns Array of available database type options
 */
export function getAvailableBlastDatabaseTypes(
  blastProgram: string,
  dbSource: string,
) {
  const availableTypes = blastDatabaseTypeMap[blastProgram]?.[dbSource] || [];
  
  return blastDatabaseTypes.filter((dbType) =>
    availableTypes.includes(dbType.value),
  );
}

/**
 * Get the default database type for a given BLAST program and database source
 * @param blastProgram - The BLAST program
 * @param dbSource - The database source
 * @returns The default database type value
 */
export function getDefaultBlastDatabaseType(
  blastProgram: string,
  dbSource: string,
): string {
  const availableTypes = blastDatabaseTypeMap[blastProgram]?.[dbSource];
  return availableTypes?.[0] || "fna";
}

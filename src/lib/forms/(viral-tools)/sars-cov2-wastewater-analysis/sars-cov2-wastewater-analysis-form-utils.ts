import type { SarsCov2WastewaterAnalysisFormData } from "./sars-cov2-wastewater-analysis-form-schema";
import type { BuildLibraryResult } from "@/lib/forms/shared-library-selection";
import {
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/shared-library-selection";
import type { Library } from "@/types/services";

/** Toast-like interface for library error reporting (avoids coupling to sonner in utils) */
export interface ToastLike {
  error: (message: string, opts?: { description?: string }) => void;
}

/**
 * Replace invalid characters in sample ID with underscore (legacy replaceInvalidChars).
 * Invalid chars: - : @ " ' ; [ ] { } | `
 */
export function sanitizeSampleId(value: string): string {
  const invalidChars = ["-", ":", "@", '"', "'", ";", "[", "]", "{", "}", "|", "`"];
  let result = value;
  for (const char of invalidChars) {
    result = result.replaceAll(char, "_");
  }
  return result;
}

/**
 * Derive default sample ID from a file path (filename without extension).
 */
export function getDefaultSampleIdFromPath(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const base = filename.split(".")[0] ?? path;
  return sanitizeSampleId(base);
}

/**
 * Derive default sample ID from SRA accession (e.g. SRR1234567.1 -> SRR1234567).
 */
export function getDefaultSampleIdFromSrr(accession: string): string {
  const base = accession.split(".")[0] ?? accession;
  return sanitizeSampleId(base);
}

/**
 * Handle library add error: show "Duplicate library" with description for known messages, else show message as-is.
 */
export function handleLibraryError(message: string, toast: ToastLike): void {
  if (
    message === "This paired library has already been added" ||
    message === "This single library has already been added"
  ) {
    toast.error("Duplicate library", { description: message });
    return;
  }
  toast.error(message);
}

/**
 * Build the (read1, read2, id) => BuildLibraryResult function for paired library add.
 * Attaches sampleId and sampleLevelDate to the library (no platform — legacy wastewater has no platform selector).
 */
export function getPairedLibraryBuildFn(
  sampleId: string,
  sampleLevelDate?: string
): (read1: string, read2: string, id: string) => BuildLibraryResult {
  return (read1, read2, id) => ({
    library: {
      id,
      name: getPairedLibraryName(read1, read2),
      type: "paired",
      files: [read1, read2],
      sampleId: sampleId.trim() || getDefaultSampleIdFromPath(read1),
      ...(sampleLevelDate?.trim() && { sampleLevelDate: sampleLevelDate.trim() }),
    } as Library,
  });
}

/**
 * Build the (read) => BuildLibraryResult function for single library add.
 * Attaches sampleId and sampleLevelDate to the library (no platform — legacy wastewater has no platform selector).
 */
export function getSingleLibraryBuildFn(
  sampleId: string,
  sampleLevelDate?: string
): (read: string) => BuildLibraryResult {
  return (read) => ({
    library: {
      id: read,
      name: getSingleLibraryName(read),
      type: "single",
      files: [read],
      sampleId: sampleId.trim() || getDefaultSampleIdFromPath(read),
      ...(sampleLevelDate?.trim() && { sampleLevelDate: sampleLevelDate.trim() }),
    } as Library,
  });
}

/** Duplicate matcher for single library: same path and type single. */
export function singleLibraryDuplicateMatcher(library: Library, read: string): boolean {
  return library.id === read && library.type === "single";
}

/**
 * Find SRA libraries that appear in nextLibs but not in prevLibs (used when normalizing newly added SRA entries).
 */
export function findNewSraLibraries(nextLibs: Library[], prevLibs: Library[]): Library[] {
  const prevSraIds = new Set(
    prevLibs.filter((lib) => lib.type === "sra").map((lib) => lib.id)
  );
  return nextLibs.filter((lib) => lib.type === "sra" && !prevSraIds.has(lib.id));
}

/**
 * Resolve sample ID and optional sample date from current form state, with optional fallback path for default sample ID.
 * Use when adding a paired or single library so the same logic is not duplicated.
 */
export function resolveSampleIdAndDate(
  currentSampleId: string,
  currentSampleDate: string,
  fallbackPath?: string | null
): { sampleId: string; sampleLevelDate?: string } {
  const sampleId =
    sanitizeSampleId(currentSampleId.trim()) ||
    (fallbackPath ? getDefaultSampleIdFromPath(fallbackPath) : "");
  const sampleLevelDate = currentSampleDate.trim() || undefined;
  return { sampleId, sampleLevelDate };
}

/**
 * Transform SARS-CoV-2 Wastewater Analysis form data to API parameters (SARS2Wastewater).
 */
export function transformSarsCov2WastewaterParams(
  data: SarsCov2WastewaterAnalysisFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    recipe: data.recipe,
    primers: data.primers,
    primer_version: data.primer_version,
    output_path: data.output_path.trim(),
    output_file: data.output_file.trim(),
  };

  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => ({
      read1: lib.read1,
      read2: lib.read2,
      sample_id: lib.sample_id.trim(),
      primers: data.primers,
      primer_version: data.primer_version,
      ...(lib.sample_level_date?.trim() && {
        sample_level_date: lib.sample_level_date.trim(),
      }),
    }));
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => ({
      read: lib.read,
      sample_id: lib.sample_id.trim(),
      primers: data.primers,
      primer_version: data.primer_version,
      ...(lib.sample_level_date?.trim() && {
        sample_level_date: lib.sample_level_date.trim(),
      }),
    }));
  }

  if (data.srr_libs && data.srr_libs.length > 0) {
    params.srr_libs = data.srr_libs.map((lib) => ({
      srr_accession: lib.srr_accession,
      sample_id: lib.sample_id.trim(),
      primers: data.primers,
      primer_version: data.primer_version,
      ...(lib.sample_level_date?.trim() && {
        sample_level_date: lib.sample_level_date.trim(),
      }),
      ...(lib.title && { title: lib.title }),
    }));
  }

  return params;
}

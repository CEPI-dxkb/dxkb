import type { SarsCov2WastewaterAnalysisFormData } from "./sars-cov2-wastewater-analysis-form-schema";
import type { BuildLibraryResult } from "@/lib/forms/tanstack-library-selection";
import {
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";

export interface ToastLike {
  error: (message: string, opts?: { description?: string }) => void;
}

/** Invalid chars: - : @ " ' ; [ ] { } | ` */
export function sanitizeSampleId(value: string): string {
  const invalidChars = ["-", ":", "@", '"', "'", ";", "[", "]", "{", "}", "|", "`"];
  let result = value;
  for (const char of invalidChars) {
    result = result.replaceAll(char, "_");
  }
  return result;
}

export function getDefaultSampleIdFromPath(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const base = filename.split(".")[0] ?? path;
  return sanitizeSampleId(base);
}

export function getDefaultSampleIdFromSrr(accession: string): string {
  const base = accession.split(".")[0] ?? accession;
  return sanitizeSampleId(base);
}

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
    },
  });
}

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
    },
  });
}

export function singleLibraryDuplicateMatcher(library: Library, read: string): boolean {
  return library.id === read && library.type === "single";
}

export { findNewSraLibraries } from "@/lib/forms/tanstack-library-selection";

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

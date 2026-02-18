import type { ViralAssemblyFormData } from "./viral-assembly-form-schema";
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
 * Viral Assembly has no platform field.
 */
export function getPairedLibraryBuildFn(): (
  read1: string,
  read2: string,
  id: string,
) => BuildLibraryResult {
  return (read1, read2, id) => ({
    library: {
      id,
      name: getPairedLibraryName(read1, read2),
      type: "paired",
      files: [read1, read2],
    } as Library,
  });
}

/**
 * Build the (read) => BuildLibraryResult function for single library add.
 * Viral Assembly has no platform field.
 */
export function getSingleLibraryBuildFn(): (read: string) => BuildLibraryResult {
  return (read) => ({
    library: {
      id: read,
      name: getSingleLibraryName(read),
      type: "single",
      files: [read],
    } as Library,
  });
}

/** Default duplicate matcher for single library: same path and type single. */
export function singleLibraryDuplicateMatcher(
  library: Library,
  read: string,
): boolean {
  return library.id === read && library.type === "single";
}

/**
 * Transform Viral Assembly form data to API parameters (ViralAssembly service).
 * Legacy API accepts one input per job: use first paired lib, first single lib, or first SRA.
 */
export function transformViralAssemblyParams(
  data: ViralAssemblyFormData,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    strategy: data.strategy,
    module: data.module,
    output_path: data.output_path.trim(),
    output_file: data.output_file.trim(),
  };

  // Only include the library type that matches the selected input type
  if (data.input_type === "paired") {
    const firstPaired = data.paired_end_libs?.[0];
    if (firstPaired?.read1 != null && firstPaired?.read2 != null) {
      params.paired_end_lib = {
        read1: firstPaired.read1,
        read2: firstPaired.read2,
      };
    }
  } else if (data.input_type === "single") {
    const firstSingle = data.single_end_libs?.[0];
    if (firstSingle?.read != null) {
      params.single_end_lib = { read: firstSingle.read };
    }
  } else if (data.input_type === "srr_accession") {
    const firstSrr = data.srr_ids?.[0];
    if (firstSrr != null) {
      params.srr_id = firstSrr;
    }
  }

  return params;
}

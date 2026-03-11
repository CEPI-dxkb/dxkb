import type {
  SarsCov2GenomeAnalysisFormData,
  SarsCov2Platform,
} from "./sars-cov2-genome-analysis-form-schema";
import type { BuildLibraryResult } from "@/lib/forms/tanstack-library-selection";
import { getPairedLibraryName, getSingleLibraryName } from "@/lib/forms/tanstack-library-selection";
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
 */
export function getPairedLibraryBuildFn(
  platform: SarsCov2Platform
): (read1: string, read2: string, id: string) => BuildLibraryResult {
  return (read1, read2, id) => ({
    library: {
      id,
      name: getPairedLibraryName(read1, read2),
      type: "paired",
      files: [read1, read2],
      platform,
    } as Library,
  });
}

/**
 * Build the (read) => BuildLibraryResult function for single library add.
 */
export function getSingleLibraryBuildFn(
  platform: SarsCov2Platform | null
): (read: string) => BuildLibraryResult {
  return (read) => {
    if (!platform) {
      return { error: "Platform must be selected for single read library" };
    }
    return {
      library: {
        id: read,
        name: getSingleLibraryName(read),
        type: "single",
        files: [read],
        platform,
      } as Library,
    };
  };
}

/** Default duplicate matcher for single library: same path and type single. */
export function singleLibraryDuplicateMatcher(library: Library, read: string): boolean {
  return library.id === read && library.type === "single";
}

/**
 * Sanitize taxonomy name for output name (legacy: replace / ( ) | : with empty string)
 */
export function sanitizeTaxonomyForOutputName(name: string): string {
  return name.replace(/\(|\)|\||\/|:/g, "").trim();
}

/**
 * Compute output name from scientific name + my label (legacy updateOutputName behavior)
 */
export function computeOutputName(scientificName: string, myLabel: string): string {
  const parts: string[] = [];
  if (scientificName.trim()) {
    parts.push(sanitizeTaxonomyForOutputName(scientificName));
  }
  if (myLabel.trim()) {
    parts.push(myLabel.trim());
  }
  return parts.join(" ") || "";
}

/**
 * Transform SARS-CoV-2 Genome Analysis form data to API parameters (ComprehensiveSARS2Analysis)
 */
export function transformSarsCov2GenomeAnalysisParams(
  data: SarsCov2GenomeAnalysisFormData
): Record<string, unknown> {
  const outputName = data.output_file?.trim() || computeOutputName(data.scientific_name, data.my_label);

  const params: Record<string, unknown> = {
    input_type: data.input_type,
    scientific_name: outputName,
    taxonomy_id: data.taxonomy_id.trim(),
    output_path: data.output_path.trim(),
    output_file: outputName,
    skip_indexing: true,
  };

  if (data.input_type === "reads") {
    params.recipe = data.recipe;
    params.primers = data.primers;
    params.primer_version = data.primer_version;

    if (data.paired_end_libs && data.paired_end_libs.length > 0) {
      params.paired_end_libs = data.paired_end_libs.map((lib) => ({
        read1: lib.read1,
        read2: lib.read2,
        platform: lib.platform,
      }));
    }

    if (data.single_end_libs && data.single_end_libs.length > 0) {
      params.single_end_libs = data.single_end_libs.map((lib) => ({
        read: lib.read,
        platform: lib.platform,
      }));
    }

    if (data.srr_ids && data.srr_ids.length > 0) {
      params.srr_ids = data.srr_ids;
    }
  } else {
    params.contigs = data.contigs?.trim() ?? "";
  }

  return params;
}

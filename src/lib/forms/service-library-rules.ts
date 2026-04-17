import type { LibraryWithSampleId } from "@/lib/forms/shared-schemas";
import {
  buildBaseLibraryItem,
  findNewSraLibraries,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";

export interface SraLibraryWithSampleId {
  srr_accession: string;
  sample_id: string;
  title?: string;
}

export function extractSampleIdFromPath(path: string, fallback = ""): string {
  const filename = path.split("/").pop() ?? "";
  return filename.split(".")[0] || fallback;
}

export function deriveSampleIdFromLibrary(library: Library): string {
  if (library.files && library.files.length > 0) {
    return extractSampleIdFromPath(library.files[0], library.id);
  }
  return library.id;
}

export function mapLibraryToSampleIdItem(
  library: Library,
): LibraryWithSampleId {
  return {
    ...buildBaseLibraryItem(library),
    sample_id: library.sampleId?.trim() || deriveSampleIdFromLibrary(library),
  };
}

export function mapSraLibraryToSampleIdItem(
  library: Library,
): SraLibraryWithSampleId {
  return {
    srr_accession: library.id,
    sample_id: library.sampleId?.trim() || library.id,
    ...(library.title && { title: library.title }),
  };
}

export function assignSampleIdToNewSraLibraries(
  nextLibraries: Library[],
  previousLibraries: Library[],
  sampleId: string,
): Library[] {
  const newSraIds = new Set(
    findNewSraLibraries(nextLibraries, previousLibraries).map(
      (lib) => lib.id,
    ),
  );

  return nextLibraries.map((library) => {
    if (library.type === "sra" && newSraIds.has(library.id)) {
      return { ...library, sampleId: sampleId.trim() || library.id };
    }
    return library;
  });
}

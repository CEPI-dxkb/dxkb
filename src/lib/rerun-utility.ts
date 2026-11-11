import type { Library } from "@/types/services";
import { navigateReservedTab } from "@/lib/reserved-tab-navigation";
import {
  getPairedLibraryId,
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/tanstack-library-selection";

const serviceRouteMap: Record<string, string> = {
  GenomeAssembly2: "/services/genome-assembly",
  GenomeAssembly: "/services/genome-assembly",
  GenomeAnnotation: "/services/genome-annotation",
  GenomeAlignment: "/services/genome-alignment",
  Homology: "/services/blast",
  PrimerDesign: "/services/primer-design",
  SimilarGenomeFinder: "/services/similar-genome-finder",
  Variation: "/services/variation-analysis",
  MetagenomeBinning: "/services/metagenomic-binning",
  MetagenomicReadMapping: "/services/metagenomic-read-mapping",
  TaxonomicClassification: "/services/taxonomic-classification",
  ViralGenomeTree: "/services/viral-genome-tree",
  MetaCATS: "/services/meta-cats",
  MSA: "/services/msa-snp-analysis",
  GenomeComparison: "/services/proteome-comparison",
  FastqUtils: "/services/fastq-utilities",
  HASubtypeNumberingConversion: "/services/influenza-ha-subtype",
  ComprehensiveSARS2Analysis: "/services/sars-cov2-genome-analysis",
  SARS2Wastewater: "/services/sars-cov2-wastewater-analysis",
  SubspeciesClassification: "/services/subspecies-classification",
  ViralAssembly: "/services/viral-assembly",
};

/** The backend stores booleans as "true"/"false" strings, so `Boolean()` alone is wrong. */
export function rerunBooleanValue(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

/** The backend sometimes serializes single-element arrays as a bare object or primitive. */
export function normalizeToArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : v != null ? [v as T] : [];
}

function generateKey(length = 8): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, length);
}

export const rerunPopupBlockedMessage =
  "Unable to open the service tab. Allow pop-ups for this site, then try again.";

/** The reserved tab was closed before the launch resolved; changing pop-up settings would not help. */
export const rerunWindowClosedMessage =
  "The service tab was closed before the form could open. Try again.";

/** Launch outcome; callers report failures, and `windowClosed` differs from `blockedPopup` because "allow pop-ups" is wrong advice for it. */
export type RerunLaunchResult =
  | { status: "opened" }
  | { status: "blockedPopup"; message: string }
  | { status: "windowClosed"; message: string }
  | { status: "unsupportedService"; message: string };

export interface RerunJobOptions {
  /** Tab from `reserveRerunWindow()`; pass it when the launch awaited work first. */
  resultWindow?: Window;
}

/** Opens a blank tab; call synchronously in the click handler before any `await`, or browsers reject it. Null if blocked. */
export function reserveRerunWindow(): Window | null {
  const reserved = window.open("", "_blank");
  if (reserved) reserved.opener = null;
  return reserved;
}

/** Closes a reserved tab after a failed launch; the close error is ignored so it cannot mask the launch failure. */
export function closeRerunWindow(reserved: Window | null | undefined): void {
  try {
    reserved?.close();
  } catch {
    // close failure ignored
  }
}

export function rerunJob(
  parameters: Record<string, unknown>,
  serviceId: string,
  { resultWindow }: RerunJobOptions = {},
): RerunLaunchResult {
  let route: string | undefined;

  if (serviceId === "GeneTree") {
    const treeType = parameters["tree_type"];
    route =
      treeType === "viral_genome"
        ? "/services/viral-genome-tree"
        : "/services/gene-protein-tree";
  } else {
    route = serviceRouteMap[serviceId];
  }

  if (!route) {
    return {
      status: "unsupportedService",
      message: `The ${serviceId} service is not currently supported in DXKB`,
    };
  }

  const key = generateKey();
  const url = `${route}?rerun_key=${key}`;

  if (resultWindow) {
    if (resultWindow.closed) {
      return { status: "windowClosed", message: rerunWindowClosedMessage };
    }
    // The reserved tab cloned sessionStorage on open, so write into its own storage instead.
    resultWindow.sessionStorage.setItem(key, JSON.stringify(parameters));
    navigateReservedTab(resultWindow, url);
    return { status: "opened" };
  }

  sessionStorage.setItem(key, JSON.stringify(parameters));

  // Sever the opener after the sessionStorage clone, matching the no-referrer policy of reserved tabs.
  const rerunWindow = reserveRerunWindow();
  if (!rerunWindow) {
    sessionStorage.removeItem(key);
    return { status: "blockedPopup", message: rerunPopupBlockedMessage };
  }
  navigateReservedTab(rerunWindow, url);
  return { status: "opened" };
}

export function buildPairedLibraries(
  rerunData: Record<string, unknown>,
  getExtra?: (lib: Record<string, string>) => Partial<Library>,
): Library[] {
  return normalizeToArray<Record<string, string>>(
    rerunData.paired_end_libs,
  ).flatMap((lib) =>
    lib.read1 && lib.read2
      ? [
          {
            id: getPairedLibraryId(lib.read1, lib.read2),
            name: getPairedLibraryName(lib.read1, lib.read2),
            type: "paired" as const,
            files: [lib.read1, lib.read2],
            ...getExtra?.(lib),
          },
        ]
      : [],
  );
}

export function buildSingleLibraries(
  rerunData: Record<string, unknown>,
  getExtra?: (lib: Record<string, string>) => Partial<Library>,
): Library[] {
  return normalizeToArray<Record<string, string>>(
    rerunData.single_end_libs,
  ).flatMap((lib) =>
    lib.read
      ? [
          {
            id: lib.read,
            name: getSingleLibraryName(lib.read),
            type: "single" as const,
            files: [lib.read],
            ...getExtra?.(lib),
          },
        ]
      : [],
  );
}

/** Tries `srr_libs` first, then falls back to `srr_ids`. */
export function buildSraLibraries(
  rerunData: Record<string, unknown>,
  getExtra?: (lib: Record<string, string>) => Partial<Library>,
): Library[] {
  const srrLibs = normalizeToArray<Record<string, string>>(rerunData.srr_libs);
  if (srrLibs.length > 0) {
    return srrLibs.flatMap((lib) =>
      lib.srr_accession
        ? [
            {
              id: lib.srr_accession,
              name: lib.srr_accession,
              type: "sra" as const,
              ...getExtra?.(lib),
            },
          ]
        : [],
    );
  }
  if (Array.isArray(rerunData.srr_ids)) {
    return (rerunData.srr_ids as string[]).map((id) => ({
      id,
      name: id,
      type: "sra" as const,
      ...getExtra?.({}),
    }));
  }
  return [];
}

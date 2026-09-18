import type { Library } from "@/types/services";
import { navigateReservedTab } from "@/lib/reserved-tab-navigation";
import {
  getPairedLibraryId,
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/tanstack-library-selection";

/**
 * Maps BV-BRC service IDs (job.app) to Next.js route paths.
 * Route groups (parentheses) are not part of the URL in Next.js App Router.
 */
const serviceRouteMap: Record<string, string> = {
  // Genomics
  GenomeAssembly2: "/services/genome-assembly",
  GenomeAssembly: "/services/genome-assembly",
  GenomeAnnotation: "/services/genome-annotation",
  GenomeAlignment: "/services/genome-alignment",
  Homology: "/services/blast",
  PrimerDesign: "/services/primer-design",
  SimilarGenomeFinder: "/services/similar-genome-finder",
  Variation: "/services/variation-analysis",
  // Metagenomics
  MetagenomeBinning: "/services/metagenomic-binning",
  MetagenomicReadMapping: "/services/metagenomic-read-mapping",
  TaxonomicClassification: "/services/taxonomic-classification",
  // Phylogenomics — GeneTree is handled separately below
  ViralGenomeTree: "/services/viral-genome-tree",
  // Protein tools
  MetaCATS: "/services/meta-cats",
  MSA: "/services/msa-snp-analysis",
  GenomeComparison: "/services/proteome-comparison",
  // Utilities
  FastqUtils: "/services/fastq-utilities",
  // Viral tools
  HASubtypeNumberingConversion: "/services/influenza-ha-subtype",
  ComprehensiveSARS2Analysis: "/services/sars-cov2-genome-analysis",
  SARS2Wastewater: "/services/sars-cov2-wastewater-analysis",
  SubspeciesClassification: "/services/subspecies-classification",
  ViralAssembly: "/services/viral-assembly",
};

/**
 * Coerces a rerun param value to boolean. The backend stores booleans as
 * "true"/"false" strings (from form transforms), so `Boolean()` alone is wrong.
 */
export function rerunBooleanValue(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

/**
 * Normalizes a value to an array. The backend sometimes serializes
 * single-element arrays as a plain object or primitive; this coerces all cases to T[].
 */
export function normalizeToArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : v != null ? [v as T] : [];
}

function generateKey(length = 8): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, length);
}

/** Shown when a pop-up blocker refuses the service tab. */
export const rerunPopupBlockedMessage =
  "Unable to open the service tab. Allow pop-ups for this site, then try again.";

/**
 * Shown when the reserved tab is gone by the time the launch resolves — most often
 * because the user closed it. Changing the pop-up setting would not help here.
 */
export const rerunWindowClosedMessage =
  "The service tab was closed before the form could open. Try again.";

/**
 * Outcome of a launch, so a caller can keep its own UI open and report the failure
 * instead of assuming the tab opened.
 *
 * Every failure is reported by the caller and never from here: the choosers show
 * theirs inline next to a retry button, the jobs list toasts, and a status that
 * both toasted itself *and* returned its message got double-reported by whichever
 * caller rendered `message`. The status also has to match the message it carries —
 * `windowClosed` is separate from `blockedPopup` because "allow pop-ups" is the
 * wrong advice for a tab the user closed, and a caller branching on the status
 * would otherwise give it.
 */
export type RerunLaunchResult =
  | { status: "opened" }
  | { status: "blockedPopup"; message: string }
  | { status: "windowClosed"; message: string }
  | { status: "unsupportedService"; message: string };

export interface RerunJobOptions {
  /**
   * A tab already opened by `reserveRerunWindow()`. Pass it whenever the launch had
   * to await work first — see that function for why.
   */
  resultWindow?: Window;
}

/**
 * Opens a blank tab for a launch that cannot navigate yet. Must be called
 * synchronously inside the click handler, before any `await`: browsers reject
 * `window.open` once the call no longer runs in the task the user's gesture
 * started. Returns null when a pop-up blocker refused the tab, which lets the
 * caller fail before it writes anything that would then be orphaned.
 */
export function reserveRerunWindow(): Window | null {
  const reserved = window.open("", "_blank");
  if (reserved) reserved.opener = null;
  return reserved;
}

/**
 * Closes a reserved tab after a failed launch. The close error is discarded on
 * purpose: cleanup must never replace the launch failure the user needs to see.
 */
export function closeRerunWindow(reserved: Window | null | undefined): void {
  try {
    reserved?.close();
  } catch {
    // Deliberately ignored — the caller still reports the original failure.
  }
}

/**
 * Stores job parameters in sessionStorage and opens the corresponding service form
 * page in a new tab with a ?rerun_key= query param. Pass `resultWindow` to navigate
 * a tab reserved with `reserveRerunWindow()` instead of opening one here.
 */
export function rerunJob(
  parameters: Record<string, unknown>,
  serviceId: string,
  { resultWindow }: RerunJobOptions = {},
): RerunLaunchResult {
  // Resolve route — GeneTree is special: tree_type determines the route
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
    // The reserved tab cloned this tab's sessionStorage when it opened, so a write
    // here would never reach it. Write into the tab's own storage instead; it
    // survives the same-origin navigation below.
    resultWindow.sessionStorage.setItem(key, JSON.stringify(parameters));
    navigateReservedTab(resultWindow, url);
    return { status: "opened" };
  }

  sessionStorage.setItem(key, JSON.stringify(parameters));

  // Opening the blank tab clones this tab's sessionStorage. Navigate only after
  // severing its opener so this path has the same no-referrer policy as a tab that
  // was reserved before asynchronous work.
  const rerunWindow = reserveRerunWindow();
  if (!rerunWindow) {
    // Nothing will ever read the payload, so do not strand it in sessionStorage.
    sessionStorage.removeItem(key);
    return { status: "blockedPopup", message: rerunPopupBlockedMessage };
  }
  navigateReservedTab(rerunWindow, url);
  return { status: "opened" };
}

/**
 * Reconstruct paired-end Library objects from raw rerun params.
 * Pass an optional `getExtra` callback to merge service-specific fields.
 */
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

/**
 * Reconstruct single-end Library objects from raw rerun params.
 * Pass an optional `getExtra` callback to merge service-specific fields.
 */
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

/**
 * Reconstruct SRA Library objects from raw rerun params.
 * Tries `srr_libs` (array of { srr_accession, ... }) first, then falls back to `srr_ids` (string[]).
 * Optional `getExtra` is invoked per library with the source record (empty object on the srr_ids fallback path).
 */
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

import { toast } from "sonner";
import type { Library } from "@/types/services";
import {
  getPairedLibraryId,
  getPairedLibraryName,
  getSingleLibraryName,
} from "@/lib/forms/tanstack-library-selection";

/**
 * Maps BV-BRC service IDs (job.app) to Next.js route paths.
 * Route groups (parentheses) are not part of the URL in Next.js App Router.
 */
const SERVICE_ROUTE_MAP: Record<string, string> = {
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

/**
 * Stores job parameters in sessionStorage and opens the
 * corresponding service form page in a new tab with a ?rerun_key= query param.
 */
export function rerunJob(
  parameters: Record<string, unknown>,
  serviceId: string,
): void {
  // Resolve route — GeneTree is special: tree_type determines the route
  let route: string | undefined;

  if (serviceId === "GeneTree") {
    const treeType = parameters["tree_type"];
    route =
      treeType === "viral_genome"
        ? "/services/viral-genome-tree"
        : "/services/gene-protein-tree";
  } else {
    route = SERVICE_ROUTE_MAP[serviceId];
  }

  if (!route) {
    toast.error(`The ${serviceId} service is not currently supported in DXKB`);
    return;
  }

  const key = generateKey();
  sessionStorage.setItem(key, JSON.stringify(parameters));
  window.open(`${route}?rerun_key=${key}`, "_blank");
}

/**
 * Reconstruct paired-end Library objects from raw rerun params.
 * Pass an optional `getExtra` callback to merge service-specific fields.
 */
export function buildPairedLibraries(
  rerunData: Record<string, unknown>,
  getExtra?: (lib: Record<string, string>) => Partial<Library>,
): Library[] {
  return normalizeToArray<Record<string, string>>(rerunData.paired_end_libs)
    .filter((lib) => lib.read1 && lib.read2)
    .map((lib) => ({
      id: getPairedLibraryId(lib.read1, lib.read2),
      name: getPairedLibraryName(lib.read1, lib.read2),
      type: "paired" as const,
      files: [lib.read1, lib.read2],
      ...getExtra?.(lib),
    }));
}

/**
 * Reconstruct single-end Library objects from raw rerun params.
 * Pass an optional `getExtra` callback to merge service-specific fields.
 */
export function buildSingleLibraries(
  rerunData: Record<string, unknown>,
  getExtra?: (lib: Record<string, string>) => Partial<Library>,
): Library[] {
  return normalizeToArray<Record<string, string>>(rerunData.single_end_libs)
    .filter((lib) => !!lib.read)
    .map((lib) => ({
      id: lib.read,
      name: getSingleLibraryName(lib.read),
      type: "single" as const,
      files: [lib.read],
      ...getExtra?.(lib),
    }));
}

/**
 * Reconstruct SRA Library objects from raw rerun params.
 * Tries `srr_libs` (array of { srr_accession }) first, then falls back to `srr_ids` (string[]).
 */
export function buildSraLibraries(rerunData: Record<string, unknown>): Library[] {
  const srrLibs = normalizeToArray<Record<string, string>>(rerunData.srr_libs);
  if (srrLibs.length > 0) {
    return srrLibs
      .filter((lib) => !!lib.srr_accession)
      .map((lib) => ({ id: lib.srr_accession, name: lib.srr_accession, type: "sra" as const }));
  }
  if (Array.isArray(rerunData.srr_ids)) {
    return (rerunData.srr_ids as string[]).map((id) => ({ id, name: id, type: "sra" as const }));
  }
  return [];
}

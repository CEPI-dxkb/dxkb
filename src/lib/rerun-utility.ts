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
 * Normalizes a value to an array. The backend sometimes serializes
 * single-element arrays as plain objects; this coerces both cases to T[].
 */
export function normalizeToArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : v && typeof v === "object" ? [v as T] : [];
}

function generateKey(length = 8): string {
  return Math.random().toString(16).substring(2, 2 + length);
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
    console.warn(`[rerunJob] No route mapped for service: ${serviceId}`);
    return;
  }

  const key = generateKey();
  sessionStorage.setItem(key, JSON.stringify(parameters));
  window.open(`${route}?rerun_key=${key}`, "_blank");
}

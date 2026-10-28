import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

/** App IDs whose job results include an HTML report button. */
export const reportAppIds = new Set([
  "ComprehensiveGenomeAnalysis",
  "GenomeAssembly",
  "GenomeAssembly2",
  "HASubtypeNumberingConversion",
  "MetagenomeBinning",
  "MetagenomicReadMapping",
  "PrimerDesign",
  "Docking",
  "CoreGenomeMLST",
  "SARS2Wastewater",
  "WholeGenomeSNPAnalysis",
]);

/**
 * Maps app IDs to the function that identifies their report file by name.
 * Based on BV-BRC WorkspaceBrowser.js button definitions.
 */
const reportFileMatchers: Partial<Record<string, (filename: string) => boolean>> = {
  GenomeAssembly: (f) => f.endsWith("_assembly_report.html"),
  GenomeAssembly2: (f) => f.endsWith("_assembly_report.html"),
  MetagenomeBinning: (f) => f === "BinningReport.html",
  MetagenomicReadMapping: (f) => f === "MetagenomicReadMappingReport.html",
  PrimerDesign: (f) => f.includes("_table.html"),
  Docking: (f) => f === "small_molecule_docking_report.html",
  CoreGenomeMLST: (f) => f === "cgMLST_Report.html",
  SARS2Wastewater: (f) => f === "SARS2Wastewater_report.html",
  WholeGenomeSNPAnalysis: (f) => f === "WholeGenomeSNP_Report.html",
};

/**
 * Finds the workspace path of a job's HTML report file. Returns the full
 * workspace path (e.g. `/user@realm/home/.jobname/report.html`) or null.
 *
 * Resolution order:
 *   1. Specific named-file matcher for the app type
 *   2. Any .html file in output_files (catches non-standard naming)
 */
export function findReportPath(meta: ResolvedPathObject): string | null {
  const appId = meta.jobSysMeta?.app?.id;
  const outputFiles = meta.jobSysMeta?.output_files ?? [];
  const matcher = appId ? reportFileMatchers[appId] : undefined;

  if (matcher) {
    for (const entry of outputFiles) {
      const filePath = entry[0];
      if (typeof filePath !== "string") continue;
      const filename = filePath.split("/").pop() ?? "";
      if (matcher(filename)) return filePath;
    }
  }

  // Broad fallback: any .html file in output_files
  for (const entry of outputFiles) {
    const filePath = entry[0];
    if (typeof filePath !== "string") continue;
    if (filePath.endsWith(".html")) return filePath;
  }

  return null;
}

/** Matches a PATRIC genome ID prefix at the start of a filename, e.g. "1386.5504.RAST.genome". */
const genomeIdPrefix = /^(\d+\.\d+)\./;

/**
 * Extracts the annotated PATRIC genome ID from a genome annotation job result.
 *
 * Resolution order:
 *   1. sysMeta.job_output.genome_id (BV-BRC annotation output object)
 *   2. sysMeta.genome_id (direct field, older format)
 *   3. parameters.genome_id
 *   4. Folder items whose name starts with a genome ID prefix
 *   5. output_files path stems that embed a genome ID prefix
 */
export function extractAnnotationGenomeId(
  meta: ResolvedPathObject,
  items: WorkspaceItem[],
): string | null {
  const raw = meta.sysMeta;

  const jobOutput = raw.job_output;
  if (typeof jobOutput === "object" && jobOutput !== null) {
    const jo = jobOutput as Record<string, unknown>;
    if (typeof jo.genome_id === "string" && jo.genome_id) {
      return jo.genome_id;
    }
  }

  if (typeof raw.genome_id === "string" && raw.genome_id) {
    return raw.genome_id;
  }

  const params = meta.jobSysMeta?.parameters;
  if (typeof params?.genome_id === "string" && params.genome_id) {
    return params.genome_id;
  }

  for (const item of items) {
    const match = genomeIdPrefix.exec(item.name);
    if (match?.[1]) return match[1];
  }

  for (const entry of meta.jobSysMeta?.output_files ?? []) {
    const filePath = entry[0];
    if (typeof filePath !== "string") continue;
    const stem = filePath.split("/").pop() ?? "";
    const match = genomeIdPrefix.exec(stem);
    if (match?.[1]) return match[1];
  }

  return null;
}

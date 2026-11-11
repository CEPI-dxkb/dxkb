import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

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

  for (const entry of outputFiles) {
    const filePath = entry[0];
    if (typeof filePath !== "string") continue;
    if (filePath.endsWith(".html")) return filePath;
  }

  return null;
}

const genomeIdPrefix = /^(\d+\.\d+)\./;

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

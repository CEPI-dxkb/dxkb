import type { EntityViewTab } from "@/components/views";
import type { GenomeViewRecord } from "./schema";

export const genomeTabKeys = [
  "overview",
  "sequences",
  "interactions",
  "genome-browser",
  "features",
  "proteins",
  "domains",
  "structures",
  "experiments",
] as const;
export type GenomeTab = (typeof genomeTabKeys)[number];

/** Legacy BV-BRC tab names (`#view_tab=browser`) the server redirects. */
const legacyGenomeTabs: Partial<Record<string, GenomeTab>> = {
  browser: "genome-browser",
};

export function parseGenomeTab(
  value: string | string[] | undefined,
): GenomeTab {
  const raw = Array.isArray(value) ? value[0] : value;
  const tab = raw === undefined ? undefined : (legacyGenomeTabs[raw] ?? raw);
  return genomeTabKeys.includes(tab as GenomeTab)
    ? (tab as GenomeTab)
    : "overview";
}

export function isBacterialGenome(genome: GenomeViewRecord): boolean {
  return genome.superkingdom?.toLowerCase() === "bacteria";
}

export function buildGenomeTabs(
  genome: GenomeViewRecord,
): readonly EntityViewTab<GenomeTab>[] {
  const bacterial = isBacterialGenome(genome);
  return [
    { key: "overview", label: "Overview" },
    { key: "sequences", label: "Sequences" },
    {
      key: "interactions",
      label: "Interactions",
      enabled: bacterial,
      disabledReason: bacterial
        ? undefined
        : "Interactions are currently available for bacterial genomes only.",
    },
    { key: "genome-browser", label: "Genome Browser" },
    { key: "features", label: "Features" },
    { key: "proteins", label: "Proteins" },
    { key: "domains", label: "Domains and Motifs" },
    {
      key: "structures",
      label: "Protein Structures",
      enabled: Boolean(genome.genome_id),
    },
    {
      key: "experiments",
      label: "Experiments",
      enabled: Boolean(genome.genome_id),
    },
  ];
}

export function canonicalGenomeTab(
  requested: string | string[] | undefined,
  genome: GenomeViewRecord,
): GenomeTab {
  const tab = parseGenomeTab(requested);
  return buildGenomeTabs(genome).find((item) => item.key === tab)?.enabled ===
    false
    ? "overview"
    : tab;
}

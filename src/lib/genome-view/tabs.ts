import type { EntityViewTab } from "@/components/views";
import type { GenomeViewRecord } from "./schema";

export const genomeTabKeys = [
  "overview",
  "sequences",
  "interactions",
  "genome-browser",
  "circular-viewer",
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
  circular: "circular-viewer",
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

/** A lineage field is an array or a comma-joined string; either way, trimmed entries. */
function lineageList(
  value: string | number | readonly (string | number)[] | undefined,
): readonly string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map((entry) => String(entry).trim());
}

function lineageNames(genome: GenomeViewRecord): readonly string[] {
  return lineageList(genome.taxon_lineage_names);
}

function lineageIds(genome: GenomeViewRecord): readonly string[] {
  return lineageList(genome.taxon_lineage_ids);
}

/**
 * Legacy `Genome.js` removed the Circular Viewer tab for viruses
 * (`changeToVirusContext`) and for eukaryotic host genomes (lineage
 * `2759`), so archaea, and any genome without lineage data, keep it. The
 * lineage ids, lineage names, and `superkingdom` each exclude on their own, so
 * a `"null"` kingdom on a viral record cannot hide the lineage.
 */
export function supportsCircularViewer(genome: GenomeViewRecord): boolean {
  const ids = lineageIds(genome);
  if (ids.includes("10239") || ids.includes("2759")) return false;
  const names = lineageNames(genome);
  if (names.includes("Viruses") || names.includes("Eukaryota")) return false;
  const kingdom = genome.superkingdom?.toLowerCase();
  return kingdom !== "viruses" && kingdom !== "eukaryota";
}

export function buildGenomeTabs(
  genome: GenomeViewRecord,
): readonly EntityViewTab<GenomeTab>[] {
  const circular = supportsCircularViewer(genome);
  return [
    { key: "overview", label: "Overview" },
    { key: "sequences", label: "Sequences" },
    // Open for every genome, bacterial or not: a genome with no interaction
    // records shows the table's empty state rather than a disabled tab.
    { key: "interactions", label: "Interactions" },
    { key: "genome-browser", label: "Genome Browser" },
    {
      key: "circular-viewer",
      label: "Circular Viewer",
      enabled: circular,
      disabledReason: circular
        ? undefined
        : "The Circular Viewer is available for bacterial and archaeal genomes only.",
    },
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

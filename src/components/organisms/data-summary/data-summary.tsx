import { SectionRetryButton } from "@/components/organisms/shared/section-retry-button";
import { StatTile } from "@/components/organisms/stat-tile/stat-tile";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchCombinedOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismSummary } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";
import { formatPrefixedErrorMessage } from "@/lib/utils";
import { overviewTabHref } from "@/lib/views/hrefs";

const summaryMetrics: {
  key: keyof OrganismSummary;
  label: string;
  description: string;
  /** The tab (and its filters) the tile links to; a tile without one is not a link. */
  tab?: { name: string; params?: Record<string, string> };
}[] = [
  {
    key: "count",
    label: "Genomes",
    description: "Assembled genome records",
    tab: { name: "genomes" },
  },
  {
    key: "uniqueFamily",
    label: "Families",
    description: "Unique taxonomy families",
  },
  {
    key: "uniqueGenus",
    label: "Genera",
    description: "Unique taxonomy genera",
  },
  {
    key: "uniqueSpecies",
    label: "Species",
    description: "Unique taxonomy species",
  },
  {
    key: "cds",
    label: "CDS",
    description: "Coding sequences",
    tab: { name: "features", params: { feature_type: "CDS" } },
  },
  {
    key: "matPeptide",
    label: "Mature Peptides",
    description: "Annotated mature peptides",
    tab: { name: "features", params: { feature_type: "mat_peptide" } },
  },
  {
    key: "pdb",
    label: "PDB Structures",
    description:
      "Experimentally determined structures (AlphaFold predictions excluded)",
    tab: { name: "protein-structures", params: { rql: "ne(method,Predicted)" } },
  },
];

/** What a tile shows for a count whose load failed. */
const unavailableCount = "Unavailable";

function formatCount(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
}

/** A tile's figure: Genomes is the header's count, and a failed PDB count reads as Unavailable, never as a number. */
function tileValue(
  key: keyof OrganismSummary,
  summary: OrganismSummary,
  genomeCount: number,
): string {
  if (key === "count") return formatCount(genomeCount);
  if (key === "pdb") {
    return summary.pdb.status === "fulfilled"
      ? formatCount(summary.pdb.value)
      : unavailableCount;
  }
  return formatCount(summary[key]);
}

export async function DataSummary({
  taxonIds,
  pathname,
}: {
  taxonIds: readonly number[];
  /** The landing page the tiles' tab links belong to, e.g. `/organisms/bacteria`. */
  pathname: string;
}) {
  // The Genomes tile counts like the Taxonomy header, not like the summary's
  // `count`. A landing page is public, so the counts are anonymous (and
  // cached). The roots' genome sets are disjoint, so their counts add, and a
  // root whose count fails rejects the whole row, as a failed summary does.
  // The PDB count is settled on its own (a slow cross-collection join), so
  // its failure marks only that tile Unavailable and adds an alert with the
  // reason and a Retry.
  const [summary, genomeCounts] = await Promise.all([
    fetchCombinedOrganismSummary(taxonIds),
    Promise.all(taxonIds.map((taxonId) => fetchTaxonGenomeCount(taxonId))),
  ]);
  const genomeCount = genomeCounts.reduce((total, count) => total + count, 0);

  const tiles = (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {summaryMetrics.map((metric) => (
        <StatTile
          key={metric.key}
          id={metric.key}
          testId={`organism-kpi-${metric.key}`}
          label={metric.label}
          value={tileValue(metric.key, summary, genomeCount)}
          description={metric.description}
          href={
            metric.tab
              ? overviewTabHref(pathname, metric.tab.name, metric.tab.params)
              : undefined
          }
          className="min-w-0"
          valueClassName="whitespace-nowrap"
        />
      ))}
    </div>
  );

  if (summary.pdb.status === "fulfilled") return tiles;
  return (
    <div className="flex flex-col gap-1.5">
      {tiles}
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-xs text-destructive"
      >
        <p>
          Some counts could not be loaded:{" "}
          {formatPrefixedErrorMessage("PDB structures", summary.pdb.reason)}
        </p>
        <SectionRetryButton />
      </div>
    </div>
  );
}

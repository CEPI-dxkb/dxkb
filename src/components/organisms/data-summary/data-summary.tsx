import type { ReactNode } from "react";
import {
  PdbCountAlert,
  PdbCountValue,
} from "@/components/organisms/shared/pdb-count";
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

function formatCount(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
}

/** A tile's figure: Genomes is the header's count, and PDB streams in on its own. */
function tileValue(
  key: keyof OrganismSummary,
  summary: OrganismSummary,
  genomeCount: number,
): ReactNode {
  if (key === "count") return formatCount(genomeCount);
  if (key === "pdb") return <PdbCountValue pdb={summary.pdb} />;
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
  // The PDB count (a slow cross-collection join) is not awaited: its tile and
  // its failure alert, with the reason and a Retry, stream in on their own.
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

  return (
    <div className="flex flex-col gap-1.5">
      {tiles}
      <PdbCountAlert
        pdb={summary.pdb}
        lead="Some counts could not be loaded"
        formatReason={(reason) =>
          formatPrefixedErrorMessage("PDB structures", reason)
        }
      />
    </div>
  );
}

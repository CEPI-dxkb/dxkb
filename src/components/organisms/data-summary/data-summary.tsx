import { CountRetryScope } from "@/components/organisms/shared/count-retry-scope";
import { PdbStatTile } from "@/components/organisms/shared/pdb-count";
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

/** A tile's figure, except PDB's (it streams in on its own): Genomes is the header's count. */
function tileValue(
  key: Exclude<keyof OrganismSummary, "pdb">,
  summary: OrganismSummary,
  genomeCount: number,
): string {
  if (key === "count") return formatCount(genomeCount);
  return formatCount(summary[key]);
}

function formatPdbReason(reason: unknown): string {
  return formatPrefixedErrorMessage("PDB structures", reason);
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
  // The PDB count (a slow cross-collection join) is not awaited: its tile
  // streams in on its own, and a failure there reads as a retrying
  // Unavailable that carries the reason.
  const [summary, genomeCounts] = await Promise.all([
    fetchCombinedOrganismSummary(taxonIds),
    Promise.all(taxonIds.map((taxonId) => fetchTaxonGenomeCount(taxonId))),
  ]);
  const genomeCount = genomeCounts.reduce((total, count) => total + count, 0);

  return (
    <CountRetryScope taxonIds={taxonIds}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
        {summaryMetrics.map(({ key, label, description, tab }) => {
          const tile = {
            id: key,
            testId: `organism-kpi-${key}`,
            label,
            description,
            href: tab
              ? overviewTabHref(pathname, tab.name, tab.params)
              : undefined,
          };
          return key === "pdb" ? (
            <PdbStatTile
              key={key}
              {...tile}
              pdb={summary.pdb}
              formatReason={formatPdbReason}
              className="min-w-0"
              valueClassName="whitespace-nowrap"
            />
          ) : (
            <StatTile
              key={key}
              {...tile}
              value={tileValue(key, summary, genomeCount)}
              className="min-w-0"
              valueClassName="whitespace-nowrap"
            />
          );
        })}
      </div>
    </CountRetryScope>
  );
}

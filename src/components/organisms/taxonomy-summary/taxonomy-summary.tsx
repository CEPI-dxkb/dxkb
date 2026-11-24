import { CountRetryScope } from "@/components/organisms/shared/count-retry-scope";
import { failedCountDescription } from "@/components/organisms/shared/failed-count";
import { PdbStatTile } from "@/components/organisms/shared/pdb-count";
import { UnavailableCount } from "@/components/organisms/shared/unavailable-count";
import { StatTile, type StatTileProps } from "@/components/organisms/stat-tile/stat-tile";
import { readSession } from "@/lib/auth/server/session";
import { getTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { overviewTabHref, taxonomyHref } from "@/lib/views/hrefs";

/** `formatUserFacingErrorMessage` fallback for a failure that says nothing. */
const genericSummaryErrorMessage = "the summary service did not answer.";

function formatReason(reason: unknown): string {
  return formatUserFacingErrorMessage(reason, genericSummaryErrorMessage);
}

/** Settles a promise into a tagged result so one failed count does not take the other tiles down. */
function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "-"
    : numberFormatter.format(value);
}

type Metric = Omit<StatTileProps, "className" | "valueClassName" | "testId">;
type CountTile = Omit<Metric, "value">;

/**
 * A count's tile: its figure in the tile as given (linked when it has an
 * `href`), or, when the count failed, a retrying `UnavailableCount` in an
 * unlinked tile (the button cannot nest inside the link) whose description
 * says why.
 */
function countMetric(tile: CountTile, figure: string, reason: string | null): Metric {
  if (reason === null) return { ...tile, value: figure };
  return {
    ...tile,
    href: undefined,
    description: failedCountDescription(tile.description, reason),
    value: <UnavailableCount reason={reason} />,
  };
}

export async function TaxonomySummary({
  taxonId,
  taxon,
}: {
  taxonId: number;
  taxon: OrganismTaxonomy | null;
}) {
  const [summaryResult, genomeCountResult] = await Promise.all([
    settle(fetchOrganismSummary(taxonId)),
    // The Taxonomy header's `TaxonGenomeCount` call, so the tile and the header always agree and share one request.
    settle(
      readSession().then((session) =>
        getTaxonGenomeCount(taxonId, session?.token),
      ),
    ),
  ]);

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  if (!summary && !taxon && summaryResult.status === "rejected") {
    throw summaryResult.reason;
  }

  // A failed count reads as a retrying Unavailable carrying its own count's
  // reason, not as "no data". The PDB count is not awaited (a slow
  // cross-collection join): its tile streams in after the rest.
  const summaryReason =
    summaryResult.status === "rejected" ? formatReason(summaryResult.reason) : null;
  const genomeCount =
    genomeCountResult.status === "fulfilled" ? genomeCountResult.value : null;
  const genomeReason =
    genomeCountResult.status === "rejected"
      ? formatReason(genomeCountResult.reason)
      : null;

  const base = taxonomyHref(taxonId);
  const pdbTile: CountTile = {
    id: "pdb",
    label: "3D Protein Structures (PDB)",
    description: "Experimentally determined structures (AlphaFold predictions excluded)",
    href: overviewTabHref(base, "protein-structures", {
      rql: "ne(method,Predicted)",
    }),
  };
  const metrics: Metric[] = [
    { id: "taxon-id", label: "Taxon ID", value: taxon ? String(taxon.taxonId) : String(taxonId), description: "NCBI taxonomy identifier" },
    { id: "taxon-name", label: "Taxon Name", value: taxon?.taxonName ?? "-", description: "Scientific name of the taxon" },
    { id: "taxon-rank", label: "Taxon Rank", value: taxon?.taxonRank ? taxon.taxonRank.charAt(0).toUpperCase() + taxon.taxonRank.slice(1) : "-", description: "Taxonomic rank" },
    countMetric(
      { id: "species", label: "Species", description: "Unique taxonomy species" },
      formatCount(summary?.uniqueSpecies),
      summaryReason,
    ),
    countMetric(
      {
        id: "genomes",
        label: "Genomes / Segments",
        description: "Assembled genome records",
        href: overviewTabHref(base, "genomes"),
      },
      formatCount(genomeCount),
      genomeReason,
    ),
    countMetric(
      {
        id: "cds",
        label: "Protein Coding Genes (CDS)",
        description: "Coding sequences",
        href: overviewTabHref(base, "features", { feature_type: "CDS" }),
      },
      formatCount(summary?.cds),
      summaryReason,
    ),
  ];

  return (
    <CountRetryScope taxonIds={[taxonId]}>
      <div className="flex flex-wrap gap-1.5">
        {metrics.map((metric) => (
          <StatTile
            key={metric.id}
            {...metric}
            testId={`taxon-stat-${metric.id}`}
            className="min-w-min grow basis-32"
            valueClassName="wrap-break-word"
          />
        ))}
        {summary ? (
          <PdbStatTile
            {...pdbTile}
            pdb={summary.pdb}
            formatReason={formatReason}
            testId="taxon-stat-pdb"
            className="min-w-min grow basis-32"
            valueClassName="wrap-break-word"
          />
        ) : (
          <StatTile
            {...countMetric(pdbTile, "-", summaryReason)}
            testId="taxon-stat-pdb"
            className="min-w-min grow basis-32"
            valueClassName="wrap-break-word"
          />
        )}
      </div>
    </CountRetryScope>
  );
}

import { SectionRetryButton } from "@/components/organisms/shared/section-retry-button";
import { Card } from "@/components/ui/card";
import { readSession } from "@/lib/auth/server/session";
import { getTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";
import { formatUserFacingErrorMessage } from "@/lib/utils";

/** What a tile shows for a count whose load failed. */
const unavailableCount = "Unavailable";

/** `formatUserFacingErrorMessage` fallback for a failure that says nothing. */
const genericSummaryErrorMessage = "the summary service did not answer.";

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

  const failure =
    summaryResult.status === "rejected"
      ? summaryResult
      : genomeCountResult.status === "rejected"
        ? genomeCountResult
        : null;
  // A failed count reads as Unavailable with a reason, not as "no data".
  const summaryError = failure
    ? formatUserFacingErrorMessage(failure.reason, genericSummaryErrorMessage)
    : null;
  const summaryCount = (value: number | null | undefined): string =>
    summaryResult.status === "rejected" ? unavailableCount : formatCount(value);
  const genomeCount =
    genomeCountResult.status === "fulfilled"
      ? formatCount(genomeCountResult.value)
      : unavailableCount;

  const metrics: { label: string; value: string; description: string }[] = [
    { label: "Taxon ID", value: taxon ? String(taxon.taxonId) : String(taxonId), description: "NCBI taxonomy identifier" },
    { label: "Taxon Name", value: taxon?.taxonName ?? "-", description: "Scientific name of the taxon" },
    { label: "Taxon Rank", value: taxon?.taxonRank ? taxon.taxonRank.charAt(0).toUpperCase() + taxon.taxonRank.slice(1) : "-", description: "Taxonomic rank" },
    { label: "Species", value: summaryCount(summary?.uniqueSpecies), description: "Unique taxonomy species" },
    {
      label: "Genomes / Segments",
      value: genomeCount,
      description: "Assembled genome records",
    },
    { label: "Protein Coding Genes (CDS)", value: summaryCount(summary?.cds), description: "Coding sequences" },
    { label: "3D Protein Structures (PDB)", value: summaryCount(summary?.pdb), description: "Protein structure links" },
  ];

  const tiles = (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          variant="tile"
          className="min-w-0 gap-0 px-2.5 py-1.5"
          title={metric.description}
        >
          <p className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
            {metric.label}
          </p>
          <p
            className="text-lg leading-tight font-bold tracking-tight wrap-break-word"
            title={metric.value}
          >
            {metric.value}
          </p>
        </Card>
      ))}
    </div>
  );

  if (!summaryError) return tiles;
  return (
    <div className="flex flex-col gap-1.5">
      {tiles}
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-xs text-destructive"
      >
        <p>Taxon counts could not be loaded: {summaryError}</p>
        <SectionRetryButton />
      </div>
    </div>
  );
}

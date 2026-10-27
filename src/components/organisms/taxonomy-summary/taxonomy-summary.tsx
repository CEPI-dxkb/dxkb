import { SectionRetryButton } from "@/components/organisms/shared/section-retry-button";
import { Card } from "@/components/ui/card";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";
import { formatUserFacingErrorMessage } from "@/lib/utils";

/** A count the summary would have given, when the summary failed. */
const unavailableCount = "Unavailable";

/** `formatUserFacingErrorMessage` fallback for a failure that says nothing. */
const genericSummaryErrorMessage = "the summary service did not answer.";

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
  // allSettled: failing the summary endpoint shouldn't blank the entire card.
  const summaryResult = await fetchOrganismSummary(taxonId).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  if (!summary && !taxon) {
    if (summaryResult.status === "rejected") throw summaryResult.reason;
  }

  // A failed summary must not read as "no data": its counts say Unavailable,
  // and one line below says why. The genome count the taxonomy record carries
  // (the breadcrumb's) still shows.
  const summaryError =
    summaryResult.status === "rejected"
      ? formatUserFacingErrorMessage(
          summaryResult.reason,
          genericSummaryErrorMessage,
        )
      : null;
  const summaryCount = (value: number | null | undefined): string =>
    summaryError ? unavailableCount : formatCount(value);
  const genomeCount = summary?.count ?? taxon?.genomes;

  const metrics: { label: string; value: string; description: string }[] = [
    { label: "Taxon ID", value: taxon ? String(taxon.taxonId) : String(taxonId), description: "NCBI taxonomy identifier" },
    { label: "Taxon Name", value: taxon?.taxonName ?? "-", description: "Scientific name of the taxon" },
    { label: "Taxon Rank", value: taxon?.taxonRank ? taxon.taxonRank.charAt(0).toUpperCase() + taxon.taxonRank.slice(1) : "-", description: "Taxonomic rank" },
    { label: "Species", value: summaryCount(summary?.uniqueSpecies), description: "Unique taxonomy species" },
    {
      label: "Genomes / Segments",
      value:
        genomeCount === null || genomeCount === undefined
          ? summaryCount(null)
          : formatCount(genomeCount),
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

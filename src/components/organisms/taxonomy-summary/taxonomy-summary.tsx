import { Card } from "@/components/ui/card";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";

function formatCount(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
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

  const metrics: { label: string; value: string; description: string }[] = [
    { label: "Taxon ID", value: taxon ? String(taxon.taxonId) : String(taxonId), description: "NCBI taxonomy identifier" },
    { label: "Taxon Name", value: taxon?.taxonName ?? "-", description: "Scientific name of the taxon" },
    { label: "Taxon Rank", value: taxon?.taxonRank ? taxon.taxonRank.charAt(0).toUpperCase() + taxon.taxonRank.slice(1) : "-", description: "Taxonomic rank" },
    { label: "Species", value: formatCount(summary?.uniqueSpecies ?? null), description: "Unique taxonomy species" },
    { label: "Genomes / Segments", value: formatCount(summary?.count ?? null), description: "Assembled genome records" },
    { label: "Protein Coding Genes (CDS)", value: formatCount(summary?.cds ?? null), description: "Coding sequences" },
    { label: "3D Protein Structures (PDB)", value: formatCount(summary?.pdb ?? null), description: "Protein structure links" },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="min-w-0 gap-0 rounded-md px-2.5 py-1.5 shadow-none"
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
}

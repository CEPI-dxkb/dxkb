import { Card } from "@/components/ui/card";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchCombinedOrganismSummary } from "@/lib/services/organisms/summary";
import type { OrganismSummary } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";

const summaryMetrics: {
  key: keyof OrganismSummary;
  label: string;
  description: string;
}[] = [
  { key: "count", label: "Genomes", description: "Assembled genome records" },
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
  { key: "cds", label: "CDS", description: "Coding sequences" },
  {
    key: "matPeptide",
    label: "Mature Peptides",
    description: "Annotated mature peptides",
  },
  {
    key: "pdb",
    label: "PDB Structures",
    description:
      "Experimentally determined structures (AlphaFold predictions excluded)",
  },
];

function formatCount(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
}

export async function DataSummary({
  taxonIds,
}: {
  taxonIds: readonly number[];
}) {
  // The Genomes tile counts like the Taxonomy header, not like the summary's
  // `count`. A landing page is public, so the counts are anonymous (and
  // cached). The roots' genome sets are disjoint, so their counts add, and a
  // root whose count fails rejects the whole tile, as a failed summary does.
  const [summary, genomeCounts] = await Promise.all([
    fetchCombinedOrganismSummary(taxonIds),
    Promise.all(taxonIds.map((taxonId) => fetchTaxonGenomeCount(taxonId))),
  ]);
  const genomeCount = genomeCounts.reduce((total, count) => total + count, 0);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {summaryMetrics.map((metric) => {
        const formattedValue = formatCount(
          metric.key === "count" ? genomeCount : summary[metric.key],
        );

        return (
          <Card
            key={metric.key}
            data-testid={`organism-kpi-${metric.key}`}
            variant="tile"
            className="min-w-0 gap-0 px-2.5 py-1.5"
            title={metric.description}
          >
            <p className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
              {metric.label}
            </p>
            <p
              className="text-lg leading-tight font-bold tracking-tight whitespace-nowrap"
              title={formattedValue}
            >
              {formattedValue}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

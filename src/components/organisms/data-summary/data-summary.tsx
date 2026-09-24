import { Card } from "@/components/ui/card";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
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
    description: "Protein structure links",
  },
];

function formatCount(value: number | null): string {
  return value === null ? "-" : numberFormatter.format(value);
}

export async function DataSummary({ taxonId }: { taxonId: number }) {
  const summary = await fetchOrganismSummary(taxonId);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {summaryMetrics.map((metric) => {
        const formattedValue = formatCount(summary[metric.key]);

        return (
          <Card
            key={metric.key}
            data-testid={`organism-kpi-${metric.key}`}
            className="min-w-0 gap-0 rounded-md px-2.5 py-1.5 shadow-none"
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

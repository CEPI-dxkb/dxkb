import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchOrganismGenera } from "@/lib/services/organisms/genera";
import { genomeListHref } from "@/lib/views/hrefs";
import { rqlAnd, rqlEq } from "@/lib/views/rql";

import { GeneraCard } from "./genera-card";

interface GeneraGridProps {
  taxonId: number;
  limit?: number;
}

export async function GeneraGrid({ taxonId, limit = 24 }: GeneraGridProps) {
  const genera = await fetchOrganismGenera(taxonId, limit);

  if (genera.length === 0) {
    return (
      <Card variant="panel">
        <CardHeader>
          <CardTitle>Top Genera</CardTitle>
          <CardDescription>No genera facets were returned.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Top Genera</h2>
        <p className="text-base text-muted-foreground">
          Ranked by available genome records.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-2">
        {genera.map((genus) => (
          <GeneraCard
            key={genus.name}
            name={genus.name}
            count={genus.count}
            href={genomeListHref({
                rql: rqlAnd(
                  rqlEq("taxon_lineage_ids", String(taxonId)),
                  rqlEq("genus", genus.name),
                ),
              })}
          />
        ))}
      </div>
    </section>
  );
}

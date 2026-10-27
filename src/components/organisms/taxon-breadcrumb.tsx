import Link from "next/link";
import type { ReactNode } from "react";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

interface TaxonBreadcrumbProps {
  taxon: OrganismTaxonomy | null;
  displayName: string;
  /** Shown after the heading: the page's streamed `TaxonGenomeCount`. */
  genomeCount?: ReactNode;
}

interface LineageEntry {
  name: string;
  id: number | null;
}

function buildLineage(names: string[], ids: number[]): LineageEntry[] {
  const lineage: LineageEntry[] = [];
  names.forEach((name, index) => {
    if (name !== "cellular organisms") {
      lineage.push({ name, id: ids[index] ?? null });
    }
  });
  return lineage;
}

export function TaxonBreadcrumb({
  taxon,
  displayName,
  genomeCount,
}: TaxonBreadcrumbProps) {
  if (!taxon) {
    return (
      <div>
        <p className="text-xs/normal font-bold tracking-widest text-foreground uppercase">
          Taxon View
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
      </div>
    );
  }

  const lineage = buildLineage(taxon.lineageNames, taxon.lineageIds);
  const ancestors = lineage.slice(0, -1);
  const current = lineage.at(-1);
  const currentName = current?.name ?? taxon.taxonName;

  return (
    <div>
      <p className="text-xs/normal font-bold tracking-widest text-foreground uppercase">
        Taxon View
      </p>
      <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
        {ancestors.map(({ name, id }) => (
          <span key={id ?? name} className="flex items-baseline gap-x-1">
            {id === null ? (
              <span className="text-muted-foreground">{name}</span>
            ) : (
              <Link
                href={`/taxonomy/${String(id)}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {name}
              </Link>
            )}
            <span className="text-muted-foreground/50 select-none">»</span>
          </span>
        ))}
        <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
          {currentName}
        </h1>
        {genomeCount}
      </div>
    </div>
  );
}

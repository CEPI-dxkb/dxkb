import Link from "next/link";
import type { ReactNode } from "react";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { taxonViewHeader } from "@/lib/taxonomy-view";
import { taxonomyHref } from "@/lib/views/hrefs";

interface TaxonBreadcrumbProps {
  taxon: OrganismTaxonomy | null;
  displayName: string;
  /** Shown after the heading: the page's streamed `TaxonGenomeCount`. */
  genomeCount?: ReactNode;
}

function Eyebrow() {
  return (
    <p className="text-xs/normal font-bold tracking-widest text-foreground uppercase">
      Taxon View
    </p>
  );
}

/** BV-BRC's Taxon View header: ranked ancestors, then the taxon as the heading, which is kept for assistive technology only when there are no crumbs. */
export function TaxonBreadcrumb({
  taxon,
  displayName,
  genomeCount,
}: TaxonBreadcrumbProps) {
  if (!taxon) {
    return (
      <div>
        <Eyebrow />
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
      </div>
    );
  }

  const { ancestors, headingHidden } = taxonViewHeader(taxon);

  return (
    <div>
      <Eyebrow />
      <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
        {ancestors.map(({ taxonId, name }, index) => (
          // A repeated rank repeats its crumb (BV-BRC's `indexOf`), so the
          // position is part of the key.
          <span
            key={`${String(index)}-${taxonId}`}
            className="flex items-baseline gap-x-1"
          >
            <Link
              href={taxonomyHref(taxonId)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {name}
            </Link>
            <span className="text-muted-foreground/50 select-none">»</span>
          </span>
        ))}
        <h1
          className={
            headingHidden
              ? "sr-only"
              : "m-0 inline text-sm leading-none font-bold text-secondary"
          }
        >
          {taxon.taxonName}
        </h1>
        {genomeCount}
      </div>
    </div>
  );
}

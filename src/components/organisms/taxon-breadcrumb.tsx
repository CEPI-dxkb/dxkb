import Link from "next/link";
import type { ReactNode } from "react";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { taxonViewCrumbs } from "@/lib/taxonomy-view";
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

/**
 * BV-BRC's Taxon View header (`buildHeaderContent`, `Taxonomy.js`): the
 * ranked ancestors (see `taxonViewCrumbs`), then the taxon itself as the
 * heading. A taxon where neither an ancestor nor the taxon itself has a shown
 * rank (a root, domain, kingdom or realm, or a clade or unranked group above
 * the first phylum) has no crumbs there, so its heading is kept for assistive
 * technology only.
 */
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

  const crumbs = taxonViewCrumbs(taxon);
  const ancestors = crumbs.slice(0, -1);
  const current = crumbs.at(-1);

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
        {current ? (
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {current.name}
          </h1>
        ) : (
          <h1 className="sr-only">{taxon.taxonName}</h1>
        )}
        {genomeCount}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";

import { defaultViewDescriptors } from "@/components/organisms/shared/default-nav-items";
import type { OrganismViewKey } from "@/components/organisms/types";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCount, type TaxonMatch } from "@/lib/search/all-types-search";
import { cn } from "@/lib/utils";

/**
 * The taxon views "Explore taxon" offers: only tabs every taxon has. Strains,
 * Surveillance, Serology and Phylogeny depend on the taxon, and a link to a
 * tab it lacks lands on the Overview.
 */
const exploredViews: readonly OrganismViewKey[] = [
  "genomes",
  "features",
  "protein-structures",
  "domains-and-motifs",
  "epitopes",
  "experiments",
];

const taxonViews = defaultViewDescriptors.filter((view) =>
  exploredViews.includes(view.key),
);

function BestMatch({ match }: { match: TaxonMatch }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/40 px-5 py-2.5">
      <span className="flex items-center gap-1.5 text-2xs font-bold tracking-wider text-muted-foreground uppercase">
        <Sparkles aria-hidden className="size-3.5" />
        Best match
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1 text-sm">
          {match.parents.map((name) => (
            <span
              key={name}
              className="flex items-baseline gap-x-1 text-muted-foreground"
            >
              {name}
              <span aria-hidden className="text-muted-foreground/50 select-none">
                »
              </span>
            </span>
          ))}
          {match.href ? (
            <Link
              href={match.href}
              className="font-bold text-secondary hover:underline"
            >
              {match.name}
            </Link>
          ) : (
            <span className="font-bold text-secondary">{match.name}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatCount(match.genomes)} genomes
          {match.rank ? ` · ${match.rank}` : ""} · Taxon ID {match.taxonId}
        </p>
      </div>
      {match.href ? (
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" size="sm" />}
            >
              Explore taxon <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{match.name}</DropdownMenuLabel>
                {taxonViews.map((view) => (
                  <DropdownMenuItem
                    key={view.key}
                    render={
                      <Link href={`${match.href ?? ""}?tab=${view.key}`} />
                    }
                  >
                    {view.icon}
                    {view.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={match.href} className={buttonVariants({ size: "sm" })}>
            Open taxon view <ArrowRight />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The page header, in the entity views' header card: the search, its totals,
 * and the best-matching taxon with links into its views.
 */
export function SearchResultsHeader({
  keyword,
  summary,
  bestMatch,
  actions,
  raised = false,
}: {
  keyword: string;
  summary: string;
  bestMatch: TaxonMatch | null;
  actions?: ReactNode;
  /** A deeper shadow, for while results scroll under the pinned header. */
  raised?: boolean;
}) {
  return (
    <header
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        raised && "shadow-md",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <p className="text-xs/normal font-bold tracking-widest text-foreground uppercase">
            Global Search
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Results for <span className="text-secondary">{keyword}</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {summary}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {bestMatch ? <BestMatch match={bestMatch} /> : null}
    </header>
  );
}

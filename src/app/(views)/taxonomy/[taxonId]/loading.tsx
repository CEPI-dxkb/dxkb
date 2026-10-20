import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { LandingNavSkeleton } from "@/components/organisms/landing-shell/landing-nav-skeleton";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// A taxon page renders OrganismLandingShell, not the list's table, so it gets
// the landing's geometry (nav rail on lg+, header card, overview) instead of
// inheriting the taxonomy list's loading state. Mirrors
// src/app/organisms/loading.tsx.
export default function TaxonLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4"
      role="status"
      aria-label="Loading taxon"
    >
      <LandingNavSkeleton />
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-18 rounded-lg" />
        <div className="flex flex-col gap-8 py-4 pr-2 pl-1">
          <DataSummarySkeleton />
          <MetadataDistributionsSkeleton />
        </div>
      </div>
    </div>
  );
}

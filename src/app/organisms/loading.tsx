import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Organism pages await taxonomy before rendering anything, so without this
// boundary a client navigation cannot commit until that fetch returns.
// Geometry mirrors LandingShellClient: nav rail (lg+), header card, overview.
export default function OrganismsLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full flex-1 flex-row gap-3 px-2 sm:px-3 lg:px-4"
      role="status"
      aria-label="Loading organism data"
    >
      <Skeleton className="hidden h-112 w-56 shrink-0 rounded-lg lg:block" />
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

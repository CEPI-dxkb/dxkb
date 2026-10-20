import { Suspense } from "react";

import { DataSummary } from "@/components/organisms/data-summary/data-summary";
import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { featuredGenera } from "@/components/organisms/genera-grid/featured-genera-data";
import { FeaturedOrganismsGrid } from "@/components/organisms/genera-grid/featured-organisms-grid";
import { GeneraGrid } from "@/components/organisms/genera-grid/genera-grid";
import { GeneraGridSkeleton } from "@/components/organisms/genera-grid/genera-grid-skeleton";
import { MetadataDistributions } from "@/components/organisms/metadata-distributions/metadata-distributions";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { withSectionError } from "@/components/organisms/shared/with-section-error";

import { bacteriaLandingConfig as config } from "../_config";

async function DataSummaryBoundary() {
  return withSectionError("Data summary", () =>
    DataSummary({ taxonId: config.taxonId }),
  );
}

async function GeneraGridBoundary() {
  return withSectionError("Top genera", () =>
    GeneraGrid({ taxonId: config.taxonId, limit: 12 }),
  );
}

async function MetadataDistributionsBoundary() {
  return withSectionError("Metadata distributions", () =>
    MetadataDistributions({
      taxonId: config.taxonId,
      fields: config.metadataFields,
      genomeList: {
        pathname: "/organisms/bacteria",
        params: { tab: "genomes" },
      },
    }),
  );
}

export function OverviewView() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<DataSummarySkeleton />}>
        <DataSummaryBoundary />
      </Suspense>

      <div className="flex min-w-0 flex-col gap-8">
        <FeaturedOrganismsGrid
          data={featuredGenera}
          title="Featured Genera"
          subtitle="Curated genera of biodefense and infectious disease relevance."
        />

        <Suspense fallback={<GeneraGridSkeleton />}>
          <GeneraGridBoundary />
        </Suspense>

        <Suspense fallback={<MetadataDistributionsSkeleton />}>
          <MetadataDistributionsBoundary />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense } from "react";

import { DataSummary } from "@/components/organisms/data-summary/data-summary";
import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { featuredAllOrganisms } from "@/components/organisms/genera-grid/featured-all-organisms-data";
import { FeaturedOrganismCategoriesGrid } from "@/components/organisms/genera-grid/featured-organism-categories-grid";
import { MetadataDistributions } from "@/components/organisms/metadata-distributions/metadata-distributions";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { withSectionError } from "@/components/organisms/shared/with-section-error";

import { allOrganismsLandingConfig as config } from "../_config";

async function DataSummaryBoundary() {
  return withSectionError("Data summary", () =>
    DataSummary({ taxonId: config.taxonId }),
  );
}

async function MetadataDistributionsBoundary() {
  return withSectionError("Metadata distributions", () =>
    MetadataDistributions({
      taxonId: config.taxonId,
      fields: config.metadataFields,
      genomeList: {
        pathname: "/organisms/all",
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
        <FeaturedOrganismCategoriesGrid
          categories={featuredAllOrganisms}
          title="Featured Organisms"
          subtitle="Curated organism groups of biodefense and infectious disease relevance."
        />

        <Suspense fallback={<MetadataDistributionsSkeleton />}>
          <MetadataDistributionsBoundary />
        </Suspense>
      </div>
    </div>
  );
}

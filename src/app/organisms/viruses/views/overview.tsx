import { Suspense } from "react";

import { DataSummary } from "@/components/organisms/data-summary/data-summary";
import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { featuredViruses } from "@/components/organisms/genera-grid/featured-viruses-data";
import { FeaturedOrganismsGrid } from "@/components/organisms/genera-grid/featured-organisms-grid";
import { MetadataDistributions } from "@/components/organisms/metadata-distributions/metadata-distributions";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { withSectionError } from "@/components/organisms/shared/with-section-error";
import { VirusFamiliesSection } from "@/components/organisms/virus-families/virus-families-section";

import { virusesLandingConfig as config } from "../_config";

/** The landing page the summary tiles and the charts link into. */
const landingPathname = "/organisms/viruses";

async function DataSummaryBoundary() {
  return withSectionError("Data summary", () =>
    DataSummary({ taxonIds: [config.taxonId], pathname: landingPathname }),
  );
}

async function MetadataDistributionsBoundary() {
  return withSectionError("Metadata distributions", () =>
    MetadataDistributions({
      taxonId: config.taxonId,
      fields: config.metadataFields,
      genomeList: {
        pathname: landingPathname,
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
        <VirusFamiliesSection />

        <FeaturedOrganismsGrid
          data={featuredViruses}
          title="Featured Viruses"
          subtitle="Curated viruses and virus groups of biodefense and infectious disease relevance."
        />

        <Suspense fallback={<MetadataDistributionsSkeleton />}>
          <MetadataDistributionsBoundary />
        </Suspense>
      </div>
    </div>
  );
}

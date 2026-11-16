import { Suspense } from "react";

import { DataSummary } from "@/components/organisms/data-summary/data-summary";
import { DataSummarySkeleton } from "@/components/organisms/data-summary/data-summary-skeleton";
import { featuredAllOrganisms } from "@/components/organisms/genera-grid/featured-all-organisms-data";
import { FeaturedOrganismCategoriesGrid } from "@/components/organisms/genera-grid/featured-organism-categories-grid";
import { MetadataDistributions } from "@/components/organisms/metadata-distributions/metadata-distributions";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { withSectionError } from "@/components/organisms/shared/with-section-error";
import { taxonIdsGenomesClause } from "@/components/organisms/taxon-views/scope";

import { allOrganismRootIds, allOrganismsLandingConfig as config } from "../_config";

/**
 * Both roots' genomes, less Deprecated: what the Genomes tab the charts link to
 * lists. It scopes Host Group, Isolation Country and the taxonomic (genus and
 * species) donut, which the All config has no sentinel for, so
 * `MetadataDistributions` adds it after the configured fields.
 */
const allOrganismGenomeQuery = {
  fieldRql: taxonIdsGenomesClause(allOrganismRootIds),
};

export async function DataSummaryBoundary() {
  return withSectionError("Data summary", () =>
    DataSummary({ taxonIds: allOrganismRootIds }),
  );
}

export async function MetadataDistributionsBoundary() {
  return withSectionError("Metadata distributions", () =>
    MetadataDistributions({
      genomeQuery: allOrganismGenomeQuery,
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

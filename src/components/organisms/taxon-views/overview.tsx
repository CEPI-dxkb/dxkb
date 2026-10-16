import { Suspense, type ReactNode } from "react";

import { GeoDistribution } from "@/components/organisms/geo-distribution/geo-distribution";
import { GeoDistributionSkeleton } from "@/components/organisms/geo-distribution/geo-distribution-skeleton";
import type { GeoDistributionAccent } from "@/components/organisms/geo-distribution/types";
import { MetadataDistributions } from "@/components/organisms/metadata-distributions/metadata-distributions";
import { MetadataDistributionsSkeleton } from "@/components/organisms/metadata-distributions/metadata-distributions-skeleton";
import { ReferenceGenomes } from "@/components/organisms/reference-genomes/reference-genomes";
import { ReferenceGenomesSkeleton } from "@/components/organisms/reference-genomes/reference-genomes-skeleton";
import type { GenomeScopeProps } from "@/components/organisms/shared/genome-scope-props";
import { withSectionError } from "@/components/organisms/shared/with-section-error";
import { TaxonomySummary } from "@/components/organisms/taxonomy-summary/taxonomy-summary";
import { TaxonomySummarySkeleton } from "@/components/organisms/taxonomy-summary/taxonomy-summary-skeleton";
import type { OrganismLandingConfig } from "@/components/organisms/types";
import type { GenomeListLink } from "@/lib/genome-view";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

interface OverviewViewProps {
  config: OrganismLandingConfig;
  taxon: OrganismTaxonomy | null;
  showAmr?: boolean;
}

interface GenomeOverviewSectionsProps {
  scope: GenomeScopeProps;
  accent: GeoDistributionAccent;
  metadataFields: string[];
  showAmr?: boolean;
  hideEmptyAmr?: boolean;
  /** The Genomes tab the metadata charts link into. */
  genomeList: GenomeListLink;
  /** Rendered above the map, e.g. the Taxonomy page's taxon summary. */
  summary?: ReactNode;
}

async function MetadataDistributionsBoundary({
  scope,
  metadataFields,
  showAmr,
  hideEmptyAmr,
  genomeList,
}: Pick<
  GenomeOverviewSectionsProps,
  "scope" | "metadataFields" | "showAmr" | "hideEmptyAmr" | "genomeList"
>) {
  return withSectionError(() =>
    MetadataDistributions({
      ...scope,
      fields: metadataFields,
      showAmr,
      hideEmptyAmr,
      genomeList,
    }),
  );
}

async function GeoDistributionBoundary({
  scope,
  accent,
}: Pick<GenomeOverviewSectionsProps, "scope" | "accent">) {
  return withSectionError(() => GeoDistribution({ ...scope, accent }));
}

async function ReferenceGenomesBoundary({
  scope,
}: Pick<GenomeOverviewSectionsProps, "scope">) {
  return withSectionError(() => ReferenceGenomes(scope));
}

/**
 * The genome sections of an overview, each streaming behind its own skeleton
 * and failing on its own: the map, the reference genomes and the metadata
 * distributions of every genome in `scope`. The Taxonomy page puts its taxon
 * summary above them; the Genome list's Overview tab shows them for its query.
 */
export function GenomeOverviewSections({
  scope,
  accent,
  metadataFields,
  showAmr,
  hideEmptyAmr,
  genomeList,
  summary,
}: GenomeOverviewSectionsProps) {
  return (
    <div className="flex flex-col gap-8">
      {summary}

      <div className="flex flex-col gap-8 xl:max-h-167 xl:flex-row xl:items-stretch">
        <section className="flex w-full flex-col xl:w-[70%]">
          <Suspense fallback={<GeoDistributionSkeleton />}>
            <GeoDistributionBoundary scope={scope} accent={accent} />
          </Suspense>
        </section>

        <section className="flex w-full flex-col xl:w-[30%] xl:min-w-0">
          <Suspense fallback={<ReferenceGenomesSkeleton />}>
            <ReferenceGenomesBoundary scope={scope} />
          </Suspense>
        </section>
      </div>

      <Suspense fallback={<MetadataDistributionsSkeleton />}>
        <MetadataDistributionsBoundary
          scope={scope}
          metadataFields={metadataFields}
          showAmr={showAmr}
          hideEmptyAmr={hideEmptyAmr}
          genomeList={genomeList}
        />
      </Suspense>
    </div>
  );
}

export function makeOverviewView({ config, taxon, showAmr }: OverviewViewProps) {
  async function TaxonomySummaryBoundary() {
    return withSectionError(() => TaxonomySummary({ taxonId: config.taxonId, taxon }));
  }

  function OverviewView() {
    return (
      <GenomeOverviewSections
        scope={{ taxonId: config.taxonId }}
        accent={config.accent}
        metadataFields={config.metadataFields}
        showAmr={showAmr}
        genomeList={{
          pathname: `/taxonomy/${String(config.taxonId)}`,
          params: { tab: "genomes" },
        }}
        summary={
          <Suspense fallback={<TaxonomySummarySkeleton />}>
            <TaxonomySummaryBoundary />
          </Suspense>
        }
      />
    );
  }

  return OverviewView;
}

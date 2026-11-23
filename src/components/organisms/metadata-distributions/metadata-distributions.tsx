import type { ReactNode } from "react";

import { fetchAmrPhenotypeDistribution } from "@/lib/services/organisms/amr-distribution";
import { fetchOrganismMetadataFacets } from "@/lib/services/organisms/metadata-facets";
import {
  amrProfileTitle,
  metadataFieldLabel,
  taxonomicDistributionTitle,
} from "@/lib/services/organisms/metadata-field-labels";
import { fetchTaxonomicDistribution } from "@/lib/services/organisms/taxonomic-distribution";
import type {
  AmrDistributionData,
  OrganismGenusFacet,
} from "@/lib/services/organisms/types";

import {
  genomeScopeFromProps,
  type GenomeScopeProps,
} from "@/components/organisms/shared/genome-scope-props";
import { ChartVisibilityGrid } from "@/components/organisms/overview-chart-visibility/chart-visibility-grid";
import { ChartVisibilityMenu } from "@/components/organisms/overview-chart-visibility/chart-visibility-menu";
import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import {
  genomeListValueHref,
  type GenomeListLink,
} from "@/lib/genome-view";
import { amrChartId, type OverviewChartViewType } from "@/lib/overview-charts";
import { describeGenomeScope } from "@/lib/services/organisms/genome-scope";
import { formatUserFacingErrorMessage } from "@/lib/utils";

import {
  LazyAmrBarStackChart,
  LazyBarChart,
  LazyDonutChart,
} from "./lazy-charts";

type MetadataDistributionsProps = GenomeScopeProps & {
  fields: string[];
  showAmr?: boolean;
  /** Leave the AMR chart out when the scope has no AMR records; a failed request still shows its error. */
  hideEmptyAmr?: boolean;
  /** The Genomes tab listing the scope's genomes; given one, each bucket links to its genomes there. */
  genomeList?: GenomeListLink;
  /** Gives the section a menu to hide charts, remembered for this view type. The organism landings pass none and show every chart. */
  viewType?: OverviewChartViewType;
};

interface ChartItem {
  id: string;
  title: string;
  node: ReactNode;
}

const emptyAmrData: AmrDistributionData = { antibiotics: [] };

interface OptionalChartState<T> {
  data: T;
  errorMessage?: string;
}

/** `formatUserFacingErrorMessage` fallback for a chart whose error says nothing. */
const genericChartErrorMessage = "the chart data could not be loaded";

function settledToChart<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
): OptionalChartState<T> {
  if (result.status === "fulfilled") return { data: result.value };
  const reason: unknown = result.reason;
  return {
    data: fallback,
    errorMessage: formatUserFacingErrorMessage(
      typeof reason === "string" ? new Error(reason) : reason,
      genericChartErrorMessage,
    ),
  };
}

export async function MetadataDistributions({
  fields,
  showAmr = false,
  hideEmptyAmr = false,
  genomeList,
  viewType,
  ...scopeProps
}: MetadataDistributionsProps) {
  const scope = genomeScopeFromProps(scopeProps);
  const hasTaxonomicSentinel = fields.includes(taxonomicDistributionSentinel);
  const fetchFields = fields.filter((f) => f !== taxonomicDistributionSentinel);

  const [facetResults, [taxonomicResult, amrResult]] = await Promise.all([
    Promise.allSettled(
      fetchFields.map(async (field) => {
        const facets = await fetchOrganismMetadataFacets(scope, [field]);
        return facets[field] ?? [];
      }),
    ),
    Promise.allSettled([
      fetchTaxonomicDistribution(scope),
      showAmr
        ? fetchAmrPhenotypeDistribution(scope)
        : Promise.resolve(emptyAmrData),
    ]),
  ]);

  const settled: PromiseSettledResult<unknown>[] = [
    ...facetResults,
    taxonomicResult,
    ...(showAmr ? [amrResult] : []),
  ];
  const firstFailure = settled.find((result) => result.status === "rejected");
  if (firstFailure && settled.every((result) => result.status === "rejected")) {
    throw firstFailure.reason;
  }

  const facetCharts = new Map<string, OptionalChartState<OrganismGenusFacet[]>>(
    fetchFields.map((field, index) => [
      field,
      settledToChart(facetResults[index], []),
    ]),
  );
  const taxonomic = settledToChart(taxonomicResult, { genus: [], species: [] });
  const amr = settledToChart(amrResult, emptyAmrData);

  for (const [field, chart] of facetCharts) {
    if (chart.errorMessage) {
      console.warn(
        `[metadata-distributions] genome ${field} facet fetch failed for ${describeGenomeScope(scope)}: ${chart.errorMessage}`,
      );
    }
  }
  if (taxonomic.errorMessage) {
    console.warn(
      `[metadata-distributions] taxonomic distribution fetch failed for ${describeGenomeScope(scope)}: ${taxonomic.errorMessage}`,
    );
  }
  if (amr.errorMessage && showAmr) {
    console.warn(
      `[metadata-distributions] amr phenotype distribution fetch failed for ${describeGenomeScope(scope)}: ${amr.errorMessage}`,
    );
  }

  const chartDatum = (field: string, facet: { name: string; count: number }) => ({
    label: facet.name,
    value: facet.count,
    href:
      genomeList && facet.count > 0
        ? genomeListValueHref(genomeList, field, facet.name)
        : undefined,
  });

  const amrHasData = amr.data.antibiotics.length > 0;
  const showAmrChart =
    showAmr && (!hideEmptyAmr || amrHasData || Boolean(amr.errorMessage));

  const taxonomicChart = (
    <LazyDonutChart
      title={taxonomicDistributionTitle}
      tabs={[
        {
          label: "Genus",
          data: taxonomic.data.genus.map((f) => chartDatum("genus", f)),
        },
        {
          label: "Species",
          data: taxonomic.data.species.map((f) => chartDatum("species", f)),
        },
      ]}
      layout="side"
      errorMessage={taxonomic.errorMessage}
    />
  );

  const taxonomicItem: ChartItem = {
    id: taxonomicDistributionSentinel,
    title: taxonomicDistributionTitle,
    node: taxonomicChart,
  };

  const items: ChartItem[] = [
    ...fields.flatMap((field): ChartItem[] => {
      if (field === taxonomicDistributionSentinel) return [taxonomicItem];

      const title = metadataFieldLabel(field);
      const chart = facetCharts.get(field);
      const data = (chart?.data ?? []).map((facet) => chartDatum(field, facet));

      if (field === "collection_year") {
        return [
          {
            id: field,
            title,
            node: (
              <LazyBarChart
                title={title}
                data={data}
                errorMessage={chart?.errorMessage}
              />
            ),
          },
        ];
      }

      return [
        {
          id: field,
          title,
          node: (
            <LazyDonutChart
              title={title}
              data={data}
              layout="side"
              errorMessage={chart?.errorMessage}
            />
          ),
        },
      ];
    }),
    ...(hasTaxonomicSentinel ? [] : [taxonomicItem]),
    ...(showAmrChart
      ? [
          {
            id: amrChartId,
            title: amrProfileTitle,
            node: (
              <div className={`flex flex-col${amrHasData ? " @[640px]:col-span-2 @[1080px]:col-span-2" : ""}`}>
                <LazyAmrBarStackChart
                  title={amrProfileTitle}
                  data={amr.data}
                  errorMessage={amr.errorMessage}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <section className="@container flex flex-col gap-3" data-testid="metadata-distributions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">
            Metadata Distributions
          </h2>
          <p className="text-sm text-muted-foreground">
            Top metadata buckets for available genome records.
          </p>
        </div>
        {viewType && (
          <ChartVisibilityMenu
            viewType={viewType}
            charts={items.map(({ id, title }) => ({ id, title }))}
          />
        )}
      </div>
      <ChartVisibilityGrid
        viewType={viewType}
        items={items.map(({ id, node }) => ({ id, node }))}
      />
    </section>
  );
}

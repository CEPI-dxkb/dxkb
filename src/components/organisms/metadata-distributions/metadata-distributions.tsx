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
import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import {
  genomeListValueHref,
  type GenomeListLink,
} from "@/lib/genome-view";
import { describeGenomeScope } from "@/lib/services/organisms/genome-scope";
import { formatUserFacingErrorMessage } from "@/lib/utils";

import { AmrBarStackChart } from "./amr-bar-stack-chart";
import { BarChart } from "./bar-chart";
import { DonutChart } from "./donut-chart";

type MetadataDistributionsProps = GenomeScopeProps & {
  fields: string[];
  showAmr?: boolean;
  /**
   * Leave the AMR chart out when the scope has no AMR records, as legacy
   * GenomeListOverview does: a Genome list has no lineage to decide `showAmr`
   * from, and a virus list would otherwise show an empty AMR card. A failed
   * request still shows its error.
   */
  hideEmptyAmr?: boolean;
  /**
   * The Genomes tab listing the scope's genomes. Given one, each chart bucket
   * links to its genomes there (`genomeListValueHref`).
   */
  genomeList?: GenomeListLink;
};

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
  ...scopeProps
}: MetadataDistributionsProps) {
  const scope = genomeScopeFromProps(scopeProps);
  const hasTaxonomicSentinel = fields.includes(taxonomicDistributionSentinel);
  const fetchFields = fields.filter((f) => f !== taxonomicDistributionSentinel);

  // One request per facet, so a facet that fails (one slow field, one bad
  // value) fails its own chart instead of the whole grid.
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

  // When nothing loaded (the service is down), one section error with a
  // Retry says it once instead of in every chart.
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

  // A bucket links to its genomes; an empty one has none to list.
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
    <DonutChart
      key={taxonomicDistributionSentinel}
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

  return (
    <section className="@container flex flex-col gap-3" data-testid="metadata-distributions">
      <div>
        <h2 className="text-lg font-semibold tracking-normal">
          Metadata Distributions
        </h2>
        <p className="text-sm text-muted-foreground">
          Top metadata buckets for available genome records.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 @[640px]:grid-cols-2 @[1080px]:grid-cols-3 @[1600px]:grid-cols-4">
        {fields.flatMap((field) => {
          if (field === taxonomicDistributionSentinel) {
            return [taxonomicChart];
          }

          const title = metadataFieldLabel(field);
          const chart = facetCharts.get(field);
          const data = (chart?.data ?? []).map((facet) =>
            chartDatum(field, facet),
          );

          if (field === "collection_year") {
            return [
              <BarChart
                key={`${field}-bar`}
                title={title}
                data={data}
                errorMessage={chart?.errorMessage}
              />,
            ];
          }

          return [
            <DonutChart
              key={field}
              title={title}
              data={data}
              layout="side"
              errorMessage={chart?.errorMessage}
            />,
          ];
        })}
        {!hasTaxonomicSentinel && taxonomicChart}
        {showAmrChart && (
          <div className={`flex flex-col${amrHasData ? " @[640px]:col-span-2 @[1080px]:col-span-2" : ""}`}>
            <AmrBarStackChart
              title={amrProfileTitle}
              data={amr.data}
              errorMessage={amr.errorMessage}
            />
          </div>
        )}
      </div>
    </section>
  );
}

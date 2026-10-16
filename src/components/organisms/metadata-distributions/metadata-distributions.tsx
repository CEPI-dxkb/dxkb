import { fetchAmrPhenotypeDistribution } from "@/lib/services/organisms/amr-distribution";
import { fetchOrganismMetadataFacets } from "@/lib/services/organisms/metadata-facets";
import { fetchTaxonomicDistribution } from "@/lib/services/organisms/taxonomic-distribution";
import type { AmrDistributionData } from "@/lib/services/organisms/types";

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

import { AmrBarStackChart } from "./amr-bar-stack-chart";
import { BarChart } from "./bar-chart";
import { DonutChart } from "./donut-chart";

const fieldLabels: Record<string, string> = {
  genus: "Genus",
  host: "Host",
  host_name: "Host Name",
  host_group: "Host Group",
  host_common_name: "Host Distribution",
  isolation_country: "Isolation Country",
  isolation_source: "Isolation Source Distribution",
  collection_year: "Collection Year",
  family: "Family",
  sequencing_centers: "Sequencing Centers",
};

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

function settledToChart<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
): OptionalChartState<T> {
  if (result.status === "fulfilled") return { data: result.value };
  const reason: unknown = result.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : reason === null || reason === undefined
        ? "unknown error"
        : typeof reason === "string" || typeof reason === "number" || typeof reason === "boolean"
          ? String(reason)
          : JSON.stringify(reason);
  return { data: fallback, errorMessage: message };
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

  const [facetsResult, taxonomicResult, amrResult] =
    await Promise.allSettled([
      fetchOrganismMetadataFacets(scope, fetchFields),
      fetchTaxonomicDistribution(scope),
      showAmr
        ? fetchAmrPhenotypeDistribution(scope)
        : Promise.resolve(emptyAmrData),
    ]);

  // The facets panel is the spine of this section — if it fails we can't lay
  // out the rest of the grid, so propagate to the route's error boundary.
  if (facetsResult.status === "rejected") {
    throw facetsResult.reason;
  }

  const facets = facetsResult.value;
  const taxonomic = settledToChart(taxonomicResult, { genus: [], species: [] });
  const amr = settledToChart(amrResult, emptyAmrData);

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
      title="Taxonomic Distribution"
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

          const title = fieldLabels[field] ?? field;
          const data = (facets[field] ?? []).map((facet) =>
            chartDatum(field, facet),
          );

          if (field === "collection_year") {
            return [
              <BarChart
                key={`${field}-bar`}
                title={title}
                data={data}
              />,
            ];
          }

          return [
            <DonutChart key={field} title={title} data={data} layout="side" />,
          ];
        })}
        {!hasTaxonomicSentinel && taxonomicChart}
        {showAmrChart && (
          <div className={`flex flex-col${amrHasData ? " @[640px]:col-span-2 @[1080px]:col-span-2" : ""}`}>
            <AmrBarStackChart
              title="Antimicrobial Resistance Profile"
              data={amr.data}
              errorMessage={amr.errorMessage}
            />
          </div>
        )}
      </div>
    </section>
  );
}

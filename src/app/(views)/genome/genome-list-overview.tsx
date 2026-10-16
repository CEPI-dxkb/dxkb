import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import { GenomeOverviewSections } from "@/components/organisms/taxon-views/overview";
import type { GenomeQueryScope } from "@/lib/services/organisms/genome-scope";
import type { CollectionState } from "@/lib/views/collection-state";

// The Taxonomy page's metadata charts (`buildTaxonomyConfig`), so a Genome
// list and a taxon summarize their genomes alike.
const genomeListMetadataFields = [
  "host_common_name",
  "host_group",
  "isolation_country",
  "isolation_source",
  taxonomicDistributionSentinel,
  "sequencing_centers",
  "collection_year",
];

/**
 * The Genome list's Overview tab: the Taxonomy page's genome sections (map,
 * reference genomes, metadata distributions) for the list's own query, as
 * legacy GenomeListOverview summarizes its query. A list has no lineage to
 * decide whether AMR applies, so the AMR chart shows when the genomes have AMR
 * records, as legacy shows its AMR section.
 */
export function GenomeListOverview({
  genomeQuery,
  state,
}: {
  genomeQuery: GenomeQueryScope;
  /** The list's state, which each chart bucket's Genomes-tab link narrows. */
  state: CollectionState;
}) {
  return (
    <GenomeOverviewSections
      scope={{ genomeQuery }}
      genomeList={{ pathname: "/genome", state }}
      accent="all"
      metadataFields={genomeListMetadataFields}
      showAmr
      hideEmptyAmr
    />
  );
}

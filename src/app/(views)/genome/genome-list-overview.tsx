import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import { GenomeOverviewSections } from "@/components/organisms/taxon-views/overview";
import type { GenomeQueryScope } from "@/lib/services/organisms/genome-scope";
import type { CollectionState } from "@/lib/views/collection-state";

const genomeListMetadataFields = [
  "host_common_name",
  "host_group",
  "isolation_country",
  "isolation_source",
  taxonomicDistributionSentinel,
  "sequencing_centers",
  "collection_year",
];

export function GenomeListOverview({
  genomeQuery,
  state,
}: {
  genomeQuery: GenomeQueryScope;
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

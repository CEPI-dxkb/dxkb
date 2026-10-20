import { ResourceChildCollection } from "@/components/views";
import { genomesChildRql } from "@/lib/views/child-resources";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeAmrPhenotypesView({ scope }: { scope: TaxonViewScope }) {
  function AmrPhenotypesView() {
    // genome_amr carries a row's own taxon_id but no lineage, so the taxon
    // reaches it through the genome join, as legacy's taxon AMR tab sends it.
    return (
      <ResourceChildCollection
        urlKey="amr"
        resource="genome_amr"
        label="AMR Phenotypes"
        idField="id"
        rql={genomesChildRql(taxonLineageClause(scope))}
        defaultSort="unsorted"
      />
    );
  }
  return AmrPhenotypesView;
}

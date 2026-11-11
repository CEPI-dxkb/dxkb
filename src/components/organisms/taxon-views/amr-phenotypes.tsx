import { LazyResourceChildCollection } from "./lazy-tab-roots";
import { genomesChildRql } from "@/lib/views/child-resources";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeAmrPhenotypesView({ scope }: { scope: TaxonViewScope }) {
  function AmrPhenotypesView() {
    // genome_amr has no lineage, so the taxon reaches it through the genome join.
    return (
      <LazyResourceChildCollection
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

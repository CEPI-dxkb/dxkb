import { LazyResourceChildCollection } from "./lazy-tab-roots";
import { genomesChildRql } from "@/lib/views/child-resources";
import { taxonGenomesClause, type TaxonViewScope } from "./scope";

export function makeAmrPhenotypesView({ scope }: { scope: TaxonViewScope }) {
  function AmrPhenotypesView() {
    // genome_amr has no lineage, so the taxon reaches it through the genome
    // join; legacy's Taxonomy view leaves Deprecated genomes out of it.
    return (
      <LazyResourceChildCollection
        urlKey="amr"
        resource="genome_amr"
        label="AMR Phenotypes"
        idField="id"
        rql={genomesChildRql(taxonGenomesClause(scope))}
        defaultSort="unsorted"
      />
    );
  }
  return AmrPhenotypesView;
}

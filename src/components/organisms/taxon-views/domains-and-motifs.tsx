import { LazyProteinFeatureResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeDomainsAndMotifsView({ scope }: { scope: TaxonViewScope }) {
  function DomainsAndMotifsView() {
    // protein_feature has no taxon_lineage_ids, so this cross-core joins to genome.
    return (
      <LazyProteinFeatureResourceCollection
        baseRql={`and(eq(genome_id,*),genome(${taxonLineageClause(scope)}))`}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return DomainsAndMotifsView;
}

import { LazyProteinStructureResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeProteinStructuresView({
  scope,
}: {
  scope: TaxonViewScope;
}) {
  function ProteinStructuresView() {
    return (
      <LazyProteinStructureResourceCollection
        baseRql={`and(eq(genome_id,*),genome(and(${taxonLineageClause(scope)},ne(genome_status,Deprecated))))`}
        enableFacets={false}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return ProteinStructuresView;
}

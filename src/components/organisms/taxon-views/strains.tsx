import { LazyStrainResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeStrainsView({ scope }: { scope: TaxonViewScope }) {
  function StrainsView() {
    return (
      <LazyStrainResourceCollection
        baseRql={taxonLineageClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return StrainsView;
}

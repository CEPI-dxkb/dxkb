import { LazyEpitopeResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeEpitopesView({ scope }: { scope: TaxonViewScope }) {
  function EpitopesView() {
    return (
      <LazyEpitopeResourceCollection
        baseRql={taxonLineageClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return EpitopesView;
}

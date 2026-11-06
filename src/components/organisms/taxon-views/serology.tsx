import { LazySerologyResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeSerologyView({ scope }: { scope: TaxonViewScope }) {
  function SerologyView() {
    return (
      <LazySerologyResourceCollection
        baseRql={taxonLineageClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return SerologyView;
}

import { LazyGenomeResourceCollection } from "./lazy-tab-roots";
import { taxonGenomesClause, type TaxonViewScope } from "./scope";

export function makeGenomesView({ scope }: { scope: TaxonViewScope }) {
  function GenomesView() {
    return (
      <LazyGenomeResourceCollection
        baseRql={taxonGenomesClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return GenomesView;
}

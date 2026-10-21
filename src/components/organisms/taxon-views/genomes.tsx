import { GenomeResourceCollection } from "@/components/views";
import { taxonGenomesClause, type TaxonViewScope } from "./scope";

export function makeGenomesView({ scope }: { scope: TaxonViewScope }) {
  function GenomesView() {
    return (
      <GenomeResourceCollection
        baseRql={taxonGenomesClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return GenomesView;
}

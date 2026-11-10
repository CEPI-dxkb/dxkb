import { LazyResourceChildCollection } from "./lazy-tab-roots";
import { taxonomySequenceRql } from "@/lib/views/child-resources";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeSequencesView({ scope }: { scope: TaxonViewScope }) {
  function SequencesView() {
    return (
      <LazyResourceChildCollection
        urlKey="sequences"
        resource="genome_sequence"
        label="Sequences"
        idField="sequence_id"
        rql={taxonomySequenceRql(taxonLineageClause(scope))}
        defaultSort="sequence_id:asc"
        guideUrl="https://www.bv-brc.org/docs/quick_references/organisms_taxon/sequences.html"
      />
    );
  }
  return SequencesView;
}

import { ResourceChildCollection } from "@/components/views";
import {
  genomeSequenceColumns,
  taxonomySequenceRql,
} from "@/lib/views/child-resources";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeSequencesView({ scope }: { scope: TaxonViewScope }) {
  function SequencesView() {
    return (
      <ResourceChildCollection
        resource="genome_sequence"
        label="Sequences"
        idField="sequence_id"
        rql={taxonomySequenceRql(taxonLineageClause(scope))}
        columns={genomeSequenceColumns}
        defaultSort="sequence_id:asc"
        guideUrl="https://www.bv-brc.org/docs/quick_references/organisms_taxon/sequences.html"
      />
    );
  }
  return SequencesView;
}

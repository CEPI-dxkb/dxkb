import { InteractionsSubviewShell } from "@/components/interactions/interactions-subview-shell";

import { taxonomyInteractionsRql } from "@/lib/views/child-resources";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeInteractionsView({ scope }: { scope: TaxonViewScope }) {
  function InteractionsView() {
    return (
      <InteractionsSubviewShell
        rql={taxonomyInteractionsRql(taxonLineageClause(scope))}
        guideUrl="https://www.bv-brc.org/docs/quick_references/organisms_taxon/interactions.html"
      />
    );
  }
  return InteractionsView;
}

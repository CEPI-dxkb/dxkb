import { TaxonomyTreePanel } from "@/components/taxonomy/taxonomy-tree-panel";
import { scopeRoots, type TaxonViewScope } from "./scope";

export function makeTaxonomyTreeView({
  scope,
  phylogenyTaxonIds,
}: {
  scope: TaxonViewScope;
  phylogenyTaxonIds: readonly number[];
}) {
  function TaxonomyTreeView() {
    return (
      <TaxonomyTreePanel
        taxa={scopeRoots(scope)}
        phylogenyTaxonIds={phylogenyTaxonIds}
      />
    );
  }
  return TaxonomyTreeView;
}

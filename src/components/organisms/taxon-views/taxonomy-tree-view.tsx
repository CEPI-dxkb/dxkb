import { LazyTaxonomyTreePanel } from "./lazy-tab-roots";
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
      <LazyTaxonomyTreePanel
        taxa={scopeRoots(scope)}
        phylogenyTaxonIds={phylogenyTaxonIds}
      />
    );
  }
  return TaxonomyTreeView;
}

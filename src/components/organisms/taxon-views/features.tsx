import { LazyFeatureResourceCollection } from "./lazy-tab-roots";
import {
  featureGridDefaultOrder,
  featureListCollectionOptions,
} from "@/lib/feature-view";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeFeaturesView({ scope }: { scope: TaxonViewScope }) {
  function FeaturesView() {
    // The Feature list's removable annotation=PATRIC default, not a pinned clause.
    return (
      <LazyFeatureResourceCollection
        baseRql={`and(eq(genome_id,*),genome(and(${taxonLineageClause(scope)},ne(genome_status,Deprecated))))`}
        collectionOptions={featureListCollectionOptions}
        enableRowLinks={false}
        keywordMode="loaded"
        unsortedOrder={featureGridDefaultOrder}
      />
    );
  }
  return FeaturesView;
}

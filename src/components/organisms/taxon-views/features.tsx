import { LazyFeatureResourceCollection } from "./lazy-tab-roots";
import {
  featureGridDefaultOrder,
  taxonFeaturesCollectionOptions,
} from "@/lib/feature-view";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeFeaturesView({ scope }: { scope: TaxonViewScope }) {
  function FeaturesView() {
    // Every annotation source, with no annotation default (DXKBCORE-362, so the
    // overview's CDS tile and this tab count alike). Legacy opened on PATRIC;
    // `taxonFeaturesCollectionOptions` says how to restore that.
    return (
      <LazyFeatureResourceCollection
        baseRql={`and(eq(genome_id,*),genome(and(${taxonLineageClause(scope)},ne(genome_status,Deprecated))))`}
        collectionOptions={taxonFeaturesCollectionOptions}
        enableRowLinks={false}
        keywordMode="loaded"
        unsortedOrder={featureGridDefaultOrder}
      />
    );
  }
  return FeaturesView;
}

import { FeatureResourceCollection } from "@/components/views";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeFeaturesView({ scope }: { scope: TaxonViewScope }) {
  function FeaturesView() {
    return (
      <FeatureResourceCollection
        baseRql={`and(eq(genome_id,*),genome(and(${taxonLineageClause(scope)},ne(genome_status,Deprecated))),eq(annotation,PATRIC))`}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return FeaturesView;
}

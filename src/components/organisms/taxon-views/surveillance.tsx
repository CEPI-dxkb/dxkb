import { LazySurveillanceResourceCollection } from "./lazy-tab-roots";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

export function makeSurveillanceView({ scope }: { scope: TaxonViewScope }) {
  function SurveillanceView() {
    return (
      <LazySurveillanceResourceCollection
        baseRql={taxonLineageClause(scope)}
        enableRowLinks={false}
        keywordMode="loaded"
      />
    );
  }
  return SurveillanceView;
}

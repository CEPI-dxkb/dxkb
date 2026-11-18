import {
  LazyExperimentBiosetCollection,
  LazyExperimentResourceCollection,
} from "./lazy-tab-roots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

// Bioset records carry no taxon or genome fields, so the tab lists the Biosets of
// the taxon's experiments by `exp_id`. The cap sits above every experiment in
// BV-BRC (920 in Nov 2026; Bacteria alone has 791), because this tab has no
// search to refine.
const maxTaxonExperiments = 5000;

export function makeExperimentsView({ scope }: { scope: TaxonViewScope }) {
  function ExperimentsView() {
    const lineageClause = taxonLineageClause(scope);

    return (
      <Tabs defaultValue="experiments" className="flex h-full min-h-0 flex-1 flex-col">
        <TabsList className="w-fit shrink-0">
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
          <TabsTrigger value="biosets">Biosets</TabsTrigger>
        </TabsList>
        <TabsContent value="experiments" className="mt-2 flex min-h-0 flex-1 flex-col">
          <LazyExperimentResourceCollection
            baseRql={lineageClause}
            enableRowLinks={false}
            keywordMode="loaded"
          />
        </TabsContent>
        <TabsContent value="biosets" className="mt-2 flex min-h-0 flex-1 flex-col">
          <LazyExperimentBiosetCollection
            baseRql={lineageClause}
            maxExperiments={maxTaxonExperiments}
          />
        </TabsContent>
      </Tabs>
    );
  }
  return ExperimentsView;
}

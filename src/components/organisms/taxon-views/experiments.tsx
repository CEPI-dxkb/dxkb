import {
  LazyExperimentBiosetCollection,
  LazyExperimentResourceCollection,
} from "./lazy-tab-roots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { experimentListHref } from "@/lib/views/hrefs";
import { taxonLineageClause, type TaxonViewScope } from "./scope";

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
          {/* Bioset records carry no taxon or genome fields, so the tab lists
              the Biosets of the taxon's experiments by `exp_id`; this tab has
              no search, so an over-long scope links to one. */}
          <LazyExperimentBiosetCollection
            baseRql={lineageClause}
            refineHref={experimentListHref({ rql: lineageClause })}
          />
        </TabsContent>
      </Tabs>
    );
  }
  return ExperimentsView;
}

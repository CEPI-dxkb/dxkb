import {
  ExperimentResourceCollection,
  ResourceChildCollection,
} from "@/components/views";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <ExperimentResourceCollection
            baseRql={lineageClause}
            enableRowLinks={false}
            keywordMode="loaded"
          />
        </TabsContent>
        <TabsContent value="biosets" className="mt-2 flex min-h-0 flex-1 flex-col">
          <ResourceChildCollection
            resource="bioset"
            label="Biosets"
            idField="bioset_id"
            rql={`and(eq(genome_id,*),genome(${lineageClause}))`}
            defaultSort="bioset_id:asc"
          />
        </TabsContent>
      </Tabs>
    );
  }
  return ExperimentsView;
}

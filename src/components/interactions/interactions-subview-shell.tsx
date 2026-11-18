"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { resetChildCollectionPage } from "@/hooks/views/use-child-collection-url-state";
import type {
  GraphCameraView,
  GraphSelectionRef,
  LayoutName,
} from "@/lib/interactions/types";
import {
  parseInteractionsGraphUrlState,
  readLiveInteractionsGraphUrlState,
  writeInteractionsGraphUrlState,
} from "@/lib/interactions/url-state";
import { interactionColumns } from "@/lib/views/child-resources";

import { InteractionsGraph } from "./interactions-graph";

const tableUrlKey = "interactions";

interface InteractionsSubviewShellProps {
  rql: string;
  guideUrl?: string;
}

export function InteractionsSubviewShell({
  rql,
  guideUrl,
}: InteractionsSubviewShellProps) {
  // The subview, keyword, single selection, layout and camera are URL state (`interactionsGraph.*`),
  // so Back from a linked feature page reopens them. The Table stays mounted; the Graph is
  // lazy-mounted and unmounts when hidden (a hidden Sigma has no size and would hold a WebGL
  // context).
  const { view, keyword, selected, layout, camera } =
    parseInteractionsGraphUrlState(useTabContentSearchParams());
  // The fragment is stripped once here so the Table's and Graph's requests carry byte-equal RQL.
  const scopedRql = rql.split("#")[0];
  // A new keyword is a new result set, so drop the stale page, selection and camera in the same
  // event; the same text keeps them. Compared with the live URL: Next renders a History API write in a
  // transition, so the rendered keyword can lag a commit.
  const handleKeywordChange = (value: string) => {
    if (value === readLiveInteractionsGraphUrlState().keyword) return;
    writeInteractionsGraphUrlState({
      keyword: value,
      selected: null,
      camera: null,
    });
    resetChildCollectionPage(tableUrlKey);
  };
  const handleSelectedChange = (next: GraphSelectionRef | null) => {
    writeInteractionsGraphUrlState({ selected: next });
  };
  // A camera frames one layout's picture; the canvas re-fits a new one.
  const handleLayoutChange = (next: LayoutName) => {
    writeInteractionsGraphUrlState({ layout: next, camera: null });
  };
  const handleCameraChange = (next: GraphCameraView | null) => {
    writeInteractionsGraphUrlState({ camera: next });
  };

  return (
    <Tabs
      value={view}
      onValueChange={(value) => {
        writeInteractionsGraphUrlState({
          view: value === "graph" ? "graph" : "table",
        });
      }}
      className="mt-2.5 flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="w-fit shrink-0">
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="graph">Graph</TabsTrigger>
      </TabsList>
      <TabsContent
        value="table"
        keepMounted
        inert={view !== "table"}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ResourceChildCollection
          urlKey={tableUrlKey}
          resource="ppi"
          label="Interactions"
          idField="id"
          rql={scopedRql}
          columns={interactionColumns}
          defaultSort="id:asc"
          guideUrl={guideUrl}
          keywordValue={keyword}
          onKeywordChange={handleKeywordChange}
          keywordPlaceholder="Search interaction results..."
        />
      </TabsContent>
      <TabsContent value="graph" className="flex min-h-0 flex-1 flex-col">
        <InteractionsGraph
          rql={scopedRql}
          keywordValue={keyword}
          onKeywordChange={handleKeywordChange}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          selected={selected}
          onSelectedChange={handleSelectedChange}
          camera={camera}
          onCameraChange={handleCameraChange}
        />
      </TabsContent>
    </Tabs>
  );
}

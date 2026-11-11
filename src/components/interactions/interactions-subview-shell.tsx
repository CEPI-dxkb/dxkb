"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import { resetChildCollectionPage } from "@/hooks/views/use-child-collection-url-state";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";
import type { LayoutName } from "@/lib/interactions/types";
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
  const [subTab, setSubTab] = useState<"table" | "graph">("table");
  // Table-only state stays mounted; the Graph is lazy-mounted and unmounts when hidden (a hidden
  // Sigma has no size and would hold a WebGL context).
  const [keywordText, setKeywordText] = useState("");
  const [graphLayout, setGraphLayout] = useState<LayoutName>(defaultLayout);
  // The fragment is stripped once here so the Table's and Graph's requests carry byte-equal RQL.
  const scopedRql = rql.split("#")[0];
  // A new keyword is a new result set, so drop the stale page in the same event; the same text
  // keeps the page.
  const handleKeywordChange = (value: string) => {
    setKeywordText(value);
    if (value !== keywordText) resetChildCollectionPage(tableUrlKey);
  };

  return (
    <Tabs
      value={subTab}
      onValueChange={(value) => { setSubTab(value as "table" | "graph"); }}
      className="mt-2.5 flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="w-fit shrink-0">
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="graph">Graph</TabsTrigger>
      </TabsList>
      <TabsContent
        value="table"
        keepMounted
        inert={subTab !== "table"}
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
          keywordValue={keywordText}
          onKeywordChange={handleKeywordChange}
          keywordPlaceholder="Search interaction results..."
        />
      </TabsContent>
      <TabsContent value="graph" className="flex min-h-0 flex-1 flex-col">
        <InteractionsGraph
          rql={scopedRql}
          keywordValue={keywordText}
          onKeywordChange={handleKeywordChange}
          layout={graphLayout}
          onLayoutChange={setGraphLayout}
        />
      </TabsContent>
    </Tabs>
  );
}

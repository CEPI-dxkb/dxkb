"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views";
import { resetChildCollectionPage } from "@/hooks/views/use-child-collection-url-state";
import { interactionColumns } from "@/lib/views/child-resources";

import { InteractionsGraph } from "./interactions-graph";

// The Table's URL param prefix, and the page param the shell drops when the shared
// keyword changes. One value, so the two cannot drift apart.
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
  // Keep table-only state (facets, pagination, sorting, selection) mounted.
  // Only keyword text is shared because both sibling views expose that input.
  // Graph remains lazy-mounted to avoid fetching its full dataset until opened.
  const [keywordText, setKeywordText] = useState("");
  // One predicate for two representations of the same data. The fragment is
  // stripped once, here, so the Table's and the Graph's requests carry byte-equal
  // RQL, and the keyword goes to both as a request predicate — a server-side
  // search whose result set does not depend on which view asked for it.
  const scopedRql = rql.split("#")[0];
  // A new keyword is a new result set for the Table, whose page lives in the URL:
  // drop the stale page in the same event the keyword changes. The same text
  // again is the same result set, so it keeps the page.
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
        />
      </TabsContent>
    </Tabs>
  );
}

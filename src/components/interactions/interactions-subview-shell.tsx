"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views";
import { interactionColumns } from "@/lib/views/child-resources";
import { rqlKeyword } from "@/lib/views/rql";

import { InteractionsGraph } from "./interactions-graph";

interface InteractionsSubviewShellProps {
  taxonId: number;
  q: string;
  guideUrl?: string;
}

export function InteractionsSubviewShell({ taxonId, q, guideUrl }: InteractionsSubviewShellProps) {
  const [subTab, setSubTab] = useState<"table" | "graph">("table");
  // Keep table-only state (facets, pagination, sorting, selection) mounted.
  // Only keyword text is shared because both sibling views expose that input.
  // Graph remains lazy-mounted to avoid fetching its full dataset until opened.
  const [keywordText, setKeywordText] = useState("");
  const tableFilter = keywordText.trim()
    ? rqlKeyword(`${keywordText.trim()}*`)
    : "";

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
          resource="ppi"
          label="Interactions"
          idField="id"
          rql={q}
          columns={interactionColumns}
          defaultSort="id:asc"
          guideUrl={guideUrl}
          keywordMode="loaded"
          keywordValue={keywordText}
          onKeywordChange={setKeywordText}
          keywordPlaceholder="Search interaction results..."
        />
      </TabsContent>
      <TabsContent value="graph" className="flex min-h-0 flex-1 flex-col">
        <InteractionsGraph
          taxonId={taxonId}
          q={q}
          tableFilter={tableFilter}
          keywordValue={keywordText}
          onKeywordChange={setKeywordText}
        />
      </TabsContent>
    </Tabs>
  );
}

"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views";
import { interactionColumns } from "@/lib/views/child-resources";

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
        {/*
          The keyword is passed as text, not as RQL: the graph turns it into one
          wildcard clause per whitespace-separated term. Building a second
          whole-string clause here produced an extra, differently-encoded predicate
          that the graph could not deduplicate, so multi-term searches returned
          fewer graph results than table rows.
        */}
        <InteractionsGraph
          taxonId={taxonId}
          q={q}
          keywordValue={keywordText}
          onKeywordChange={setKeywordText}
        />
      </TabsContent>
    </Tabs>
  );
}

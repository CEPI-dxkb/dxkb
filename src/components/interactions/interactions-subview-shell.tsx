"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import {
  resetChildCollectionPage,
  useChildCollectionUrlState,
} from "@/hooks/views/use-child-collection-url-state";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";
import type { LayoutName } from "@/lib/interactions/types";
import { childCollectionOptions } from "@/lib/views/child-collection-state";
import { interactionCollectionProfile } from "@/lib/views/child-resources";
import type { CollectionState } from "@/lib/views/collection-state";
import { scopedStructuralRql } from "@/lib/views/scoped-structural-rql";

import { InteractionsGraph } from "./interactions-graph";

const tableUrlKey = "interactions";
const tableDefaultSort = "id:asc";
// The expression `ResourceChildCollection` builds from the profile, so the shell
// and the Table parse the same `interactions.*` params into the same state.
const interactionOptions = childCollectionOptions(
  interactionCollectionProfile.columns,
  interactionCollectionProfile.facets,
  tableDefaultSort,
);
const buildGraphStructuralRql = interactionCollectionProfile.buildStructuralRql;

function sameFilters(
  left: CollectionState["filters"],
  right: CollectionState["filters"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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
  // The filters live in the Table's `interactions.*` URL params; either view's
  // Filters menu writes them, and both read them back from there.
  const [tableState, setTableState] = useChildCollectionUrlState(
    tableUrlKey,
    interactionOptions,
  );
  // The fragment is stripped once here so the Table's and Graph's requests carry byte-equal RQL.
  const scopedRql = rql.split("#")[0];
  // The Table folds the filters into its own request from the same URL state, so
  // its `rql` stays the bare scope (a new one would remount it); only the Graph,
  // which has no collection state, gets them composed in, by the same function.
  const graphRqlFor = (filters: CollectionState["filters"]) =>
    scopedStructuralRql(scopedRql, buildGraphStructuralRql)({
      ...tableState,
      filters,
    });
  const graphRql = graphRqlFor(tableState.filters);
  const facetRql = (field: string) =>
    graphRqlFor(
      Object.fromEntries(
        Object.entries(tableState.filters).filter(([name]) => name !== field),
      ),
    );
  // A new keyword is a new result set, so drop the stale page in the same event; the same text
  // keeps the page.
  const handleKeywordChange = (value: string) => {
    setKeywordText(value);
    if (value !== keywordText) resetChildCollectionPage(tableUrlKey);
  };
  // New filters are a new result set too; the URL state keeps no keyword (the
  // shared text is held above), as the Table's own writes do.
  const handleFilterChange = (update: {
    keyword?: string;
    filters: CollectionState["filters"];
  }) => {
    const nextKeyword = update.keyword ?? "";
    if (nextKeyword !== keywordText) handleKeywordChange(nextKeyword);
    if (!sameFilters(update.filters, tableState.filters)) {
      setTableState({
        ...tableState,
        filters: update.filters,
        page: 1,
        keyword: undefined,
      });
    }
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
          profile={{ ...interactionCollectionProfile, guideUrl }}
          defaultSort={tableDefaultSort}
          keywordValue={keywordText}
          onKeywordChange={handleKeywordChange}
          keywordPlaceholder="Search interaction results..."
        />
      </TabsContent>
      <TabsContent value="graph" className="flex min-h-0 flex-1 flex-col">
        <InteractionsGraph
          rql={graphRql}
          keywordValue={keywordText}
          onKeywordChange={handleKeywordChange}
          filters={tableState.filters}
          facetRql={facetRql}
          onFilterChange={handleFilterChange}
          layout={graphLayout}
          onLayoutChange={setGraphLayout}
        />
      </TabsContent>
    </Tabs>
  );
}

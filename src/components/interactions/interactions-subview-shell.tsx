"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import {
  resetChildCollectionPage,
  useChildCollectionUrlState,
} from "@/hooks/views/use-child-collection-url-state";
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";
import type { GNode, LayoutName } from "@/lib/interactions/types";
import type { InteractionsSelection } from "@/lib/interactions/use-interactions";
import {
  interactionCollectionOptions,
  interactionCollectionProfile,
} from "@/lib/views/child-resources";
import {
  facetCountState,
  type CollectionState,
} from "@/lib/views/collection-state";
import { scopedStructuralRql } from "@/lib/views/scoped-structural-rql";

import { InteractionsGraph } from "./interactions-graph";

const tableUrlKey = "interactions";
const buildGraphStructuralRql = interactionCollectionProfile.buildStructuralRql;

/**
 * The Graph keys a selection's read on its version, so every Show in Graph takes a new one: a
 * reused version would serve an earlier selection's cached rows. Module-level, so a remounted
 * shell cannot start over at a version the cache still holds.
 */
let selectionVersion = 0;

/** Called from the Show in Graph event only, never during render. */
function nextSelectionVersion(): number {
  selectionVersion += 1;
  return selectionVersion;
}

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
  // Filters menu writes them, and both read them back from there. The options
  // are the profile's own, so the shell and the Table parse the same params into
  // the same state, and neither one's write drops the other's (the focus among
  // them).
  const [tableState, setTableState] = useChildCollectionUrlState(
    tableUrlKey,
    interactionCollectionOptions,
  );
  // The fragment is stripped once here so the Table's and Graph's requests carry byte-equal RQL.
  const scopedRql = rql.split("#")[0];
  // Table rows shown in the Graph by id (Show in Graph). The Table keeps its own selection and
  // scope; a new scope drops this one, whose rows belong to the old scope.
  const [graphSelection, setGraphSelection] =
    useState<InteractionsSelection | null>(null);
  const [selectionScope, setSelectionScope] = useState(scopedRql);
  if (selectionScope !== scopedRql) {
    setSelectionScope(scopedRql);
    setGraphSelection(null);
  }
  const handleShowInGraph = (ids: string[]) => {
    setGraphSelection({ ids, version: nextSelectionVersion() });
    setSubTab("graph");
  };
  // The Table folds the filters into its own request from the same URL state, so
  // its `rql` stays the bare scope (a new one would remount it); only the Graph,
  // which has no collection state, gets them composed in, by the same function.
  const graphRqlFor = (filters: CollectionState["filters"]) =>
    scopedStructuralRql(scopedRql, buildGraphStructuralRql)({
      ...tableState,
      filters,
    });
  const graphRql = graphRqlFor(tableState.filters);
  // The counts follow the Table's rule (`facetCountState`, which leaves out defaults the user has
  // not touched; the Interactions options have none today), so the two Filters menus show the same
  // numbers for the same filters; on top of that each field leaves out its own filter.
  const countFilters = facetCountState(
    tableState,
    interactionCollectionOptions,
  ).filters;
  const facetRql = (field: string) =>
    graphRqlFor(
      Object.fromEntries(
        Object.entries(countFilters).filter(([name]) => name !== field),
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

  // The Graph's "Focus on this protein": the node becomes an `interactor` filter,
  // which narrows the Table too. A pushed entry, so Back undoes it. A Show in Graph selection is
  // left too: its rows are read by id, so the filter would not change what is drawn.
  const handleFocusNode = (node: GNode) => {
    setGraphSelection(null);
    setTableState({
      ...tableState,
      filters: { ...tableState.filters, interactor: [node.id] },
      page: 1,
      keyword: undefined,
    });
  };
  // A blank value (a hand-edited URL) is no focus; the rql builder skips it too.
  const { interactor: focusIds = [] } = tableState.filters;
  const focusId = focusIds.find((id) => id !== "");

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
          defaultSort={interactionCollectionOptions.defaultSort}
          keywordValue={keywordText}
          onKeywordChange={handleKeywordChange}
          keywordPlaceholder="Search interaction results..."
          onShowInGraph={handleShowInGraph}
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
          focusId={focusId}
          onFocusNode={handleFocusNode}
          selection={
            graphSelection
              ? {
                  ...graphSelection,
                  onClear: () => {
                    setGraphSelection(null);
                  },
                }
              : undefined
          }
          layout={graphLayout}
          onLayoutChange={setGraphLayout}
        />
      </TabsContent>
    </Tabs>
  );
}

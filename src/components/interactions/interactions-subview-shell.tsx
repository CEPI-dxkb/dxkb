"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CollectionToolbarLayoutProvider } from "@/components/views/collection-filters/toolbar-layout";
import { ResourceChildCollection } from "@/components/views/resource-child-collection";
import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { useChildCollectionUrlState } from "@/hooks/views/use-child-collection-url-state";
import { focusSelectionRef } from "@/lib/interactions/graph-selections";
import type {
  GNode,
  GraphCameraView,
  GraphSelectionRef,
  LayoutName,
} from "@/lib/interactions/types";
import type { InteractionsSelection } from "@/lib/interactions/use-interactions";
import {
  applyInteractionsGraphUrlState,
  liveTabScope,
  parseInteractionsGraphUrlState,
  readLiveInteractionsGraphUrlState,
  writeInteractionsGraphUrlState,
} from "@/lib/interactions/url-state";
import { deleteChildCollectionPage } from "@/lib/views/child-collection-state";
import {
  interactionCollectionOptions,
  interactionCollectionProfile,
} from "@/lib/views/child-resources";
import {
  facetCountState,
  type CollectionState,
} from "@/lib/views/collection-state";
import { scopedStructuralRql } from "@/lib/views/scoped-structural-rql";
import { replaceQuery } from "@/lib/url";

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

/** A blank value (a hand-edited URL) is no focus; the rql builder skips it too. */
function focusIdOf(filters: CollectionState["filters"]): string | undefined {
  const { interactor: focusIds = [] } = filters;
  return focusIds.find((id) => id !== "");
}

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
  const searchParams = useTabContentSearchParams();
  const { view, keyword, selected, layout, camera } =
    parseInteractionsGraphUrlState(searchParams);
  // The page and tab this shell is on, for a keyword the Graph's filter bar flushes on unmount:
  // after a details-pane link or a tab switch the live URL is already the next one's (as for the
  // canvas's camera reports), and the draft must not land there. A Table/Graph switch keeps both.
  const pathname = usePathname();
  const tab = searchParams.get("tab") ?? "";
  const renderedScopeRef = useRef<string | null>(null);
  useEffect(() => {
    renderedScopeRef.current = liveTabScope();
  }, [pathname, tab]);
  // The filters live in the Table's `interactions.*` URL params; either view's
  // Filters menu writes them, and both read them back from there. The options
  // are the profile's own, so the shell and the Table parse the same params into
  // the same state, and neither one's write drops the other's (the focus among
  // them). The two prefixes are disjoint, so neither writer drops the other's.
  const [tableState, setTableState] = useChildCollectionUrlState(
    tableUrlKey,
    interactionCollectionOptions,
  );
  // The fragment is stripped once here so the Table's and Graph's requests carry byte-equal RQL.
  const scopedRql = rql.split("#")[0];
  const focusId = focusIdOf(tableState.filters);
  // Table rows shown in the Graph by id (Show in Graph). The Table keeps its own selection and
  // scope; a new scope drops this one, whose rows belong to the old scope. Component state, not
  // URL state: up to `interactionsGraphRowLimit` (10,000) ids do not fit in an address.
  const [graphSelection, setGraphSelection] =
    useState<InteractionsSelection | null>(null);
  const [selectionScope, setSelectionScope] = useState(scopedRql);
  if (selectionScope !== scopedRql) {
    setSelectionScope(scopedRql);
    setGraphSelection(null);
  }
  // Every new result set (keyword, filters, focus, Show in Graph) selects the focused protein, or
  // nothing, and drops the camera, in the same write that starts it.
  const handleShowInGraph = (ids: string[]) => {
    setGraphSelection({ ids, version: nextSelectionVersion() });
    writeInteractionsGraphUrlState({
      view: "graph",
      selected: focusSelectionRef(focusId),
      camera: null,
    });
  };
  const handleClearShowInGraph = () => {
    setGraphSelection(null);
    writeInteractionsGraphUrlState({
      selected: focusSelectionRef(focusId),
      camera: null,
    });
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
  // A new keyword is a new result set, so the stale Table page, selection and camera go in the same
  // `replaceState` as the keyword: a separate page write would leave a render pairing the new keyword
  // with the old page, which the Table would request. The same text keeps them. Compared with the
  // live URL: Next renders a History API write in a transition, so the rendered keyword can lag a
  // commit.
  const handleKeywordChange = (value: string) => {
    const renderedScope = renderedScopeRef.current;
    if (renderedScope !== null && liveTabScope() !== renderedScope) return;
    if (value === readLiveInteractionsGraphUrlState().keyword) return;
    replaceQuery((params) => {
      applyInteractionsGraphUrlState(params, {
        keyword: value,
        selected: focusSelectionRef(focusId),
        camera: null,
      });
      deleteChildCollectionPage(params, tableUrlKey);
    });
  };
  const handleSelectedChange = (next: GraphSelectionRef | null) => {
    writeInteractionsGraphUrlState({ selected: next });
  };
  // A camera frames one layout's picture; the canvas re-fits a new one.
  const handleLayoutChange = (next: LayoutName) => {
    writeInteractionsGraphUrlState({ layout: next, camera: null });
  };
  // A Show in Graph picture's camera is not kept: the ids are not in the URL, so Back draws the full
  // scope, which that zoom does not frame (Show in Graph already wrote `cam` away).
  const handleCameraChange = (next: GraphCameraView | null) => {
    if (graphSelection) return;
    writeInteractionsGraphUrlState({ camera: next });
  };
  // New filters are a new result set too: a pushed `interactions.*` entry (page 1; the table state
  // keeps no keyword, the shared one is `interactionsGraph.q`), then the keyword, selection and
  // camera replaced into that same entry, so one Back step undoes the pick.
  const handleFilterChange = (update: {
    keyword?: string;
    filters: CollectionState["filters"];
  }) => {
    const nextKeyword = update.keyword ?? "";
    if (sameFilters(update.filters, tableState.filters)) {
      handleKeywordChange(nextKeyword);
      return;
    }
    setTableState({
      ...tableState,
      filters: update.filters,
      page: 1,
      keyword: undefined,
    });
    writeInteractionsGraphUrlState({
      keyword: nextKeyword,
      selected: focusSelectionRef(focusIdOf(update.filters)),
      camera: null,
    });
  };

  // The Graph's "Focus on this protein": the node becomes an `interactor` filter,
  // which narrows the Table too, and the selected node. A pushed entry, so Back undoes it. A Show
  // in Graph selection is left too: its rows are read by id, so the filter would not change what is
  // drawn.
  const handleFocusNode = (node: GNode) => {
    setGraphSelection(null);
    setTableState({
      ...tableState,
      filters: { ...tableState.filters, interactor: [node.id] },
      page: 1,
      keyword: undefined,
    });
    writeInteractionsGraphUrlState({
      selected: focusSelectionRef(node.id),
      camera: null,
    });
  };

  // One header row in either subview: the single Table|Graph pill is pinned over the start of
  // both subviews' toolbar rows, which reserve its width (`view-switch-host` in globals.css), so a
  // switch neither moves nor remounts it and focus stays on it. `top-1 inset-s-1` matches the
  // toolbar row's `p-1`; `mt-1.5` and the card's `mb-0.5` put the controls 12px under the card.
  return (
    <Tabs
      value={view}
      onValueChange={(value) => {
        writeInteractionsGraphUrlState({
          view: value === "graph" ? "graph" : "table",
        });
      }}
      className="relative mt-1.5 flex min-h-0 flex-1 flex-col view-switch-host"
    >
      <TabsList className="absolute inset-s-1 top-1 z-10 w-(--view-switch-width)">
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="graph">Graph</TabsTrigger>
      </TabsList>
      <CollectionToolbarLayoutProvider value="besideViewSwitch">
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
            profile={{ ...interactionCollectionProfile, guideUrl }}
            defaultSort={interactionCollectionOptions.defaultSort}
            keywordValue={keyword}
            onKeywordChange={handleKeywordChange}
            keywordPlaceholder="Search interaction results..."
            onShowInGraph={handleShowInGraph}
          />
        </TabsContent>
        <TabsContent value="graph" className="flex min-h-0 flex-1 flex-col">
          <InteractionsGraph
            rql={graphRql}
            scopeRql={scopedRql}
            keywordValue={keyword}
            onKeywordChange={handleKeywordChange}
            filters={tableState.filters}
            facetRql={facetRql}
            onFilterChange={handleFilterChange}
            focusId={focusId}
            onFocusNode={handleFocusNode}
            selection={
              graphSelection
                ? { ...graphSelection, onClear: handleClearShowInGraph }
                : undefined
            }
            layout={layout}
            onLayoutChange={handleLayoutChange}
            selected={selected}
            onSelectedChange={handleSelectedChange}
            camera={camera}
            onCameraChange={handleCameraChange}
          />
        </TabsContent>
      </CollectionToolbarLayoutProvider>
    </Tabs>
  );
}

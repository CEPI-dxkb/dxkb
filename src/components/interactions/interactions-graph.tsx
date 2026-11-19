"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollectionToolbarLayout } from "@/components/views/collection-filters/toolbar-layout";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useFacetCounts } from "@/hooks/views/use-facet-counts";
import { DataRepository } from "@/lib/data-api";
import {
  interactionsGraphRowLimit,
  useInteractions,
  useInteractionsTotal,
  type InteractionsSelection,
} from "@/lib/interactions/use-interactions";
import { toGraph } from "@/lib/interactions/to-graph";
import {
  buildGraphSelectionIndex,
  focusSelectionRef,
  resolveGraphSelection,
  selectHubs,
  selectSubgraphs,
  singleSelectionRef,
} from "@/lib/interactions/graph-selections";
import {
  applySelectionClick,
  buildIncidenceIndex,
} from "@/lib/interactions/selection-focus";
import { useGraphLayout } from "@/lib/interactions/use-graph-layout";
import { cn, formatUserFacingErrorMessage } from "@/lib/utils";
import { interactionFacets } from "@/lib/views/child-resources";
import type { CollectionState } from "@/lib/views/collection-state";
import type {
  GEdge,
  GNode,
  GraphCameraView,
  GraphCanvasHandle,
  GraphCanvasProps,
  GraphSelection,
  GraphSelectionRef,
  HubSelection,
  LayoutName,
  PpiRecord,
  SubgraphSelection,
} from "@/lib/interactions/types";

import { GraphFilterBar } from "./graph-filter-bar";
import { GraphActionBar } from "./graph-action-bar";
import { GraphLegend } from "./graph-legend";
import { GraphColumns } from "./graph-columns";
import { GraphControls } from "./graph-controls";
import { GraphDetailPanel } from "./graph-detail-panel";
import { GraphNodeList } from "./graph-node-list";
import { GraphTruncationNotice } from "./graph-truncation-notice";
import { InteractionsGraphSkeleton } from "./interactions-graph-skeleton";

const SigmaCanvas = dynamic<GraphCanvasProps>(
  () => import("./sigma/sigma-canvas").then((mod) => mod.SigmaCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        Loading graph…
      </div>
    ),
  },
);

const emptyRows: PpiRecord[] = [];

const repository = new DataRepository();
const facetFieldList = interactionFacets.map((facet) => facet.field);
const noFacetFields: readonly string[] = [];
const genericFacetErrorMessage =
  "The filter values could not be loaded. Please try again.";

/**
 * Stands in for the keyword box and Filters menu while the Graph shows a Table selection: the
 * selection is read by id, so neither would change what is drawn. It takes the toolbar's frame,
 * so it keeps the toolbar's place in the header row.
 */
function GraphSelectionBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  const layout = useCollectionToolbarLayout();
  return (
    <div className={layout.frame}>
      <div className={cn("flex h-10 items-center gap-2 p-1", layout.rowInset)}>
        <Badge variant="secondary">
          {`Showing ${count.toLocaleString()} selected ${count === 1 ? "interaction" : "interactions"}`}
        </Badge>
        <Button variant="outline" size="xs" onClick={onClear}>
          Show all
        </Button>
      </div>
    </div>
  );
}

function sameSelectionRef(
  a: GraphSelectionRef | null,
  b: GraphSelectionRef | null,
): boolean {
  return a?.kind === b?.kind && a?.id === b?.id;
}

interface InteractionsGraphProps {
  /**
   * The scope with the filters already composed in by the shell. The shared keyword is not folded
   * in here; it travels as the request's own `keyword`, as for the Table.
   */
  rql: string;
  /**
   * The unfiltered scope `rql` narrows. Only a new scope resets the selection here: every narrowing
   * the shell starts writes its own selection, and a Back step restores the entry's.
   */
  scopeRql: string;
  keywordValue: string;
  /** A keyword-only commit from the filter bar. */
  onKeywordChange: (value: string) => void;
  layout: LayoutName;
  onLayoutChange: (layout: LayoutName) => void;
  filters: CollectionState["filters"];
  /** Scope for one facet field's counts: the scope rql with every filter except that field's. */
  facetRql: (field: string) => string | undefined;
  /** A filter change from the filter bar, with the keyword it was made under. */
  onFilterChange: (update: {
    keyword?: string;
    filters: CollectionState["filters"];
  }) => void;
  /**
   * The protein the view is narrowed to; a new scope selects it (the shell writes it with every
   * other new result set), and loaded rows that lack it drop it like any stale id.
   */
  focusId?: string;
  /** Offers "Focus on this protein" in the detail panel; omitted, the panel has no button. */
  onFocusNode?: (node: GNode) => void;
  /**
   * Table rows to draw instead of the scope (Show in Graph), read by id; `rql`, the keyword and
   * the filters do not apply while it is set. `onClear` goes back to the scope.
   */
  selection?: InteractionsSelection & { onClear: () => void };
  /** The one selected node or edge, kept by the owner (the URL) and resolved here against the loaded graph. */
  selected: GraphSelectionRef | null;
  /** `null` for no selection or a multi-item one, which stays local. */
  onSelectedChange: (next: GraphSelectionRef | null) => void;
  /** The owner's (URL) camera, applied by the canvas on its first load. */
  camera: GraphCameraView | null;
  onCameraChange: (next: GraphCameraView | null) => void;
}

export function InteractionsGraph({
  rql,
  scopeRql,
  keywordValue,
  onKeywordChange,
  layout,
  onLayoutChange,
  filters,
  facetRql,
  onFilterChange,
  focusId,
  onFocusNode,
  selection: rowSelection,
  selected,
  onSelectedChange,
  camera,
  onCameraChange,
}: InteractionsGraphProps) {
  // Above every early return: the Graph stays mounted through loading, error and loaded, so the
  // counts keep loading once the user has reached for the filters.
  const [facetsWanted, setFacetsWanted] = useState(false);
  // A selection has no Filters menu, so it asks for no counts.
  const facetFields =
    facetsWanted && !rowSelection ? facetFieldList : noFacetFields;
  const facetCounts = useFacetCounts({
    repository,
    resource: "ppi",
    idField: "id",
    facetFields,
    rqlFor: facetRql,
    keyword: keywordValue || undefined,
  });
  const facetsRetry = useRetryKeepingError(
    {
      error: facetCounts.facetsError,
      isFetching: facetCounts.isFacetsLoading || facetCounts.isFacetsRefreshing,
      refetch: facetCounts.refetchFacets,
    },
    JSON.stringify([rql, filters, keywordValue, facetFields]),
  );
  const interactions = useInteractions(rql, keywordValue, rowSelection);
  const { data } = interactions;
  // Only a truncated scope result has a count worth a second read; a selection is never truncated.
  // A count that is loading or failed leaves the notice title without it: the graph itself loaded.
  const interactionsTotal = useInteractionsTotal(
    rql,
    keywordValue,
    Boolean(data?.isTruncated) && !rowSelection,
  );
  const selectionVersion = rowSelection?.version;
  const loadRetry = useRetryKeepingError(
    interactions,
    JSON.stringify([rql, keywordValue, selectionVersion]),
  );
  // A Sub-Graph or Hub pick (or any multi-item one) overrides the owner's single selection.
  const [bulkSelection, setBulkSelection] = useState<GraphSelection | null>(
    null,
  );
  // The owner renders a write to `selected` in a transition (Next applies History API writes in
  // one), so the single pick just made is held here until the prop catches up: the pane and canvas
  // show it at once, and a quick Cmd/Ctrl-click after a plain one adds to it rather than to the old
  // selection. The hold ends when `selected` moves off `basis`, the value the pick replaced. That is
  // safe only because Next applies every History API write to one router-state hook and React
  // renders pending transitions on one hook together, so `selected` jumps from `basis` straight to
  // the last write and never rests on an in-between one.
  const [pendingSelected, setPendingSelected] = useState<{
    ref: GraphSelectionRef | null;
    basis: GraphSelectionRef | null;
  } | null>(null);
  const [activeSubgraph, setActiveSubgraph] =
    useState<SubgraphSelection | null>(null);
  const [activeHub, setActiveHub] = useState<HubSelection | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasHandleRef = useRef<GraphCanvasHandle | null>(null);
  const [graphSource, setGraphSource] = useState({
    rql,
    keywordValue,
    selectionVersion,
    data,
  });
  if (
    graphSource.rql !== rql ||
    graphSource.keywordValue !== keywordValue ||
    graphSource.selectionVersion !== selectionVersion ||
    graphSource.data !== data
  ) {
    // The single selection is the owner's, so the first data arrival (a restore from the URL) keeps
    // it; the owner replaces it on a new keyword, filter, focus or Show in Graph, and the scope
    // effect below on a new scope.
    setGraphSource({ rql, keywordValue, selectionVersion, data });
    setBulkSelection(null);
    setPendingSelected(null);
    setActiveSubgraph(null);
    setActiveHub(null);
  }
  // The pick just written stands until the owner's `selected` moves off the value it replaced.
  if (
    pendingSelected !== null &&
    !sameSelectionRef(pendingSelected.basis, selected)
  ) {
    setPendingSelected(null);
  }

  // Memoized on the rows by hand: `SigmaCanvas` reloads its graph and re-fits the camera when the
  // node arrays change identity, and the compiler re-ran these on every URL write (a selection or
  // camera move), which threw away a restored or chosen zoom.
  const rows = data?.rows ?? emptyRows;
  const graph = useMemo(() => toGraph(rows), [rows]);
  const selectionIndex = useMemo(
    () => buildGraphSelectionIndex(graph.nodes, graph.edges),
    [graph],
  );
  // Memoized on the graph, not left to the compiler: a new index each render gives the canvas a new
  // focus set and re-installs its reducers on every selection or camera write.
  const incidenceIndex = useMemo(
    () => buildIncidenceIndex(graph.edges),
    [graph],
  );
  const selection =
    bulkSelection ??
    resolveGraphSelection(
      selectionIndex,
      pendingSelected ? pendingSelected.ref : selected,
    );
  // Loaded data that lacks the id (a stale or hand-edited URL): select nothing and drop the param.
  const selectedIsStale =
    data !== undefined &&
    selected !== null &&
    bulkSelection === null &&
    pendingSelected === null &&
    selection.nodes.length === 0 &&
    selection.edges.length === 0;
  const dropSelected = useEffectEvent(() => {
    onSelectedChange(null);
  });
  useEffect(() => {
    if (selectedIsStale) dropSelected();
  }, [selectedIsStale]);
  const resetSelected = useEffectEvent(() => {
    onSelectedChange(focusSelectionRef(focusId));
  });
  // Keyed on the scope, not the narrowed rql: the shell writes the selection with every keyword,
  // pick, focus and Show in Graph, and a Back step over one of those must keep its entry's.
  const scopeRqlRef = useRef(scopeRql);
  useEffect(() => {
    if (scopeRqlRef.current === scopeRql) return;
    scopeRqlRef.current = scopeRql;
    resetSelected();
  }, [scopeRql]);
  const layoutQuery = useGraphLayout({
    rql,
    keywordValue,
    data,
    nodes: graph.nodes,
    edges: graph.edges,
    layout,
  });

  function handleLayoutChange(name: LayoutName) {
    onLayoutChange(name);
  }

  // A counts failure beside a rows failure is a quiet note in the menu, as in the Table: the rows'
  // alert already says why.
  const toolbar = rowSelection ? (
    <GraphSelectionBar
      count={rowSelection.ids.length}
      onClear={rowSelection.onClear}
    />
  ) : (
    <GraphFilterBar
      keyword={keywordValue || undefined}
      filters={filters}
      facets={facetCounts.facets}
      facetStatuses={facetCounts.facetStatuses}
      facetsError={
        facetsRetry.error && !loadRetry.error
          ? formatUserFacingErrorMessage(
              facetsRetry.error,
              genericFacetErrorMessage,
            )
          : undefined
      }
      facetsUnavailable={Boolean(facetsRetry.error && loadRetry.error)}
      facetsRetrying={facetsRetry.retrying}
      onRetryFacets={facetsRetry.retry}
      onFacetsWanted={() => {
        setFacetsWanted(true);
      }}
      onPrefetchFacets={() => {
        facetCounts.prefetchFacets(facetFieldList);
      }}
      onChange={(update) => {
        // The bar hands back `filters` itself when only the keyword moved (nothing pending).
        if (update.filters === filters) {
          onKeywordChange(update.keyword ?? "");
          return;
        }
        onFilterChange({ keyword: update.keyword, filters: update.filters });
      }}
    />
  );

  // The toolbar renders in every state, first in the same wrapper, so a keyword or filter matching
  // nothing cannot strand the user without a way to clear it, and an open Filters menu survives the
  // pick's reload.
  if (loadRetry.error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <Alert variant="destructive">
          <AlertTitle>Could not load interactions</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                loadRetry.error,
                "Failed to load interactions.",
              )}
            </p>
            <QueryRetryButton
              retrying={loadRetry.retrying}
              onRetry={loadRetry.retry}
            />
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <InteractionsGraphSkeleton
          layout={layout}
          onLayoutChange={handleLayoutChange}
        />
      </div>
    );
  }

  const { nodes, edges } = graph;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const selectedNodeIds = new Set(selection.nodes.map((node) => node.id));

  function clearActivePreset() {
    setActiveSubgraph(null);
    setActiveHub(null);
  }
  /** One node or edge goes to the owner; anything larger stays local. */
  function applySelection(next: GraphSelection) {
    clearActivePreset();
    const single = singleSelectionRef(next);
    const isEmpty = next.nodes.length === 0 && next.edges.length === 0;
    setBulkSelection(single !== null || isEmpty ? null : next);
    setPendingSelected({ ref: single, basis: selected });
    onSelectedChange(single);
  }
  // A plain click replaces the selection; a Cmd/Ctrl one toggles the node in or out of it.
  function selectNode(node: GNode, additive = false) {
    applySelection(
      applySelectionClick(selection, { kind: "node", node }, additive),
    );
  }
  // Shift-click in the list: the range is the whole selection, however many nodes it holds.
  function selectNodes(range: GNode[]) {
    applySelection({ nodes: range, edges: [] });
  }
  function selectEdge(edge: GEdge) {
    applySelection({ nodes: [], edges: [edge] });
  }
  // A preset stays a bulk pick even when it matches one node, so it keeps its menu label and is
  // not written to the URL.
  function handleSelectSubgraphs(threshold: SubgraphSelection) {
    setActiveSubgraph(threshold);
    setActiveHub(null);
    setBulkSelection(selectSubgraphs(selectionIndex, threshold));
    setPendingSelected(null);
    onSelectedChange(null);
  }
  function handleSelectHubs(threshold: HubSelection) {
    setActiveSubgraph(null);
    setActiveHub(threshold);
    setBulkSelection(selectHubs(selectionIndex, threshold));
    setPendingSelected(null);
    onSelectedChange(null);
  }

  // The count and the export are separate reads, so a count that is not past the row limit cannot
  // describe a truncated result (a stale one would read "first 5,000 of 4,990"): the title goes
  // without it.
  const totalShown =
    interactionsTotal.data !== undefined &&
    interactionsTotal.data > interactionsGraphRowLimit
      ? interactionsTotal.data
      : undefined;
  // Defensive: `useInteractions` already reports a Show in Graph selection (read by id) as never
  // truncated, so this guard only keeps the notice off if that ever changes.
  const showTruncation = data.isTruncated && !rowSelection;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      <GraphColumns
        list={
          <div className="flex h-full flex-col rounded-tl-md border-t border-l bg-card">
            <div className="border-b p-3">
              <GraphLegend />
            </div>
            <div className="min-h-0 flex-1">
              <GraphNodeList
                nodes={nodes}
                selectedIds={selectedNodeIds}
                incidence={incidenceIndex}
                onSelectNode={selectNode}
                onSelectRange={selectNodes}
              />
            </div>
          </div>
        }
        canvas={
          <div className="flex h-full min-h-0 min-w-0 flex-col border-t">
            <GraphActionBar
              layout={layout}
              activeSubgraph={activeSubgraph}
              activeHub={activeHub}
              onLayoutChange={handleLayoutChange}
              onExport={() => {
                canvasHandleRef.current?.exportPng();
              }}
              onSelectSubgraphs={handleSelectSubgraphs}
              onSelectHubs={handleSelectHubs}
              exportReady={
                canvasReady &&
                nodes.length > 0 &&
                !layoutQuery.isFetching &&
                layoutQuery.data !== undefined
              }
            />
            {/* The WebGL canvases have no accessible role; keep this wrapper exposed for SigmaCanvas's labeled zoom controls. */}
            <div className="relative min-h-0 flex-1">
              {nodes.length === 0 ? (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  No Interactions
                </div>
              ) : (
                <SigmaCanvas
                  nodes={nodes}
                  edges={edges}
                  incidence={incidenceIndex}
                  positions={layoutQuery.data ?? null}
                  selection={selection}
                  onSelect={applySelection}
                  handleRef={canvasHandleRef}
                  onReady={() => {
                    setCanvasReady(true);
                  }}
                  camera={camera}
                  onCameraChange={onCameraChange}
                />
              )}
              {nodes.length > 0 && <GraphControls />}
              {layoutQuery.isFetching && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground"
                >
                  Laying out…
                </div>
              )}
              {/* One column over the canvas's top, so the notice and the layout error stack rather
                 than overlap; above the "Laying out…" veil, and clicks pass through to the canvas
                 except on their controls. */}
              {(showTruncation || layoutQuery.isError) && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1 p-2">
                  {showTruncation && (
                    <GraphTruncationNotice
                      limit={interactionsGraphRowLimit}
                      total={totalShown}
                    />
                  )}
                  {layoutQuery.isError && (
                    <div className="pointer-events-auto">
                      <Alert variant="destructive">
                        <AlertTitle>Could not lay out the graph</AlertTitle>
                        <AlertDescription>
                          <p>
                            {formatUserFacingErrorMessage(
                              layoutQuery.error,
                              "Failed to lay out the graph.",
                            )}
                          </p>
                          <QueryRetryButton
                            retrying={layoutQuery.isFetching}
                            onRetry={() => {
                              void layoutQuery.refetch();
                            }}
                          />
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        }
        details={
          <div
            className="h-full overflow-y-auto border-t bg-card"
            tabIndex={0}
            aria-label="Selection details"
          >
            <GraphDetailPanel
              selection={selection}
              incidentEdgesByNode={incidenceIndex}
              nodesById={nodesById}
              onSelectEdge={selectEdge}
              onSelectNode={selectNode}
              onFocusNode={onFocusNode}
            />
          </div>
        }
      />
    </div>
  );
}

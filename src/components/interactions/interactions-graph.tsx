"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import {
  interactionsGraphRowLimit,
  useInteractions,
} from "@/lib/interactions/use-interactions";
import { toGraph } from "@/lib/interactions/to-graph";
import {
  buildGraphSelectionIndex,
  selectHubs,
  selectSubgraphs,
} from "@/lib/interactions/graph-selections";
import { useGraphLayout } from "@/lib/interactions/use-graph-layout";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import type {
  GEdge,
  GNode,
  GraphCanvasHandle,
  GraphCanvasProps,
  GraphSelection,
  HubSelection,
  LayoutName,
  PpiRecord,
  SubgraphSelection,
} from "@/lib/interactions/types";

import { GraphToolbar } from "./graph-toolbar";
import { GraphActionBar } from "./graph-action-bar";
import { GraphLegend } from "./graph-legend";
import { GraphDetailPanel } from "./graph-detail-panel";
import { GraphNodeList } from "./graph-node-list";
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

const emptySelection: GraphSelection = { nodes: [], edges: [] };
const emptyRows: PpiRecord[] = [];

interface InteractionsGraphProps {
  /** The shared keyword is not folded in here; it travels as the request's own `keyword`, as for the Table. */
  rql: string;
  keywordValue: string;
  onKeywordChange: (value: string) => void;
  layout: LayoutName;
  onLayoutChange: (layout: LayoutName) => void;
}

export function InteractionsGraph({
  rql,
  keywordValue,
  onKeywordChange,
  layout,
  onLayoutChange,
}: InteractionsGraphProps) {
  const interactions = useInteractions(rql, keywordValue);
  const { data } = interactions;
  const loadRetry = useRetryKeepingError(
    interactions,
    JSON.stringify([rql, keywordValue]),
  );
  const [selection, setSelection] = useState<GraphSelection>(emptySelection);
  const [activeSubgraph, setActiveSubgraph] =
    useState<SubgraphSelection | null>(null);
  const [activeHub, setActiveHub] = useState<HubSelection | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasHandleRef = useRef<GraphCanvasHandle | null>(null);
  const [graphSource, setGraphSource] = useState({ rql, keywordValue, data });
  if (
    graphSource.rql !== rql ||
    graphSource.keywordValue !== keywordValue ||
    graphSource.data !== data
  ) {
    setGraphSource({ rql, keywordValue, data });
    setSelection(emptySelection);
    setActiveSubgraph(null);
    setActiveHub(null);
  }

  const graph = toGraph(data?.rows ?? emptyRows);
  const selectionIndex = buildGraphSelectionIndex(graph.nodes, graph.edges);
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

  const toolbar = (
    <GraphToolbar filterValue={keywordValue} onFilterChange={onKeywordChange} />
  );

  // The toolbar renders in every state so a keyword matching nothing cannot strand the user without
  // a way to clear it.
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
  const selectedNode =
    selection.nodes.length === 1 ? selection.nodes[0] : undefined;
  const incidentEdges = selectedNode
    ? edges.filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id,
      )
    : [];

  function clearActivePreset() {
    setActiveSubgraph(null);
    setActiveHub(null);
  }
  function selectNode(node: GNode) {
    clearActivePreset();
    setSelection({ nodes: [node], edges: [] });
  }
  function selectEdge(edge: GEdge) {
    clearActivePreset();
    setSelection({ nodes: [], edges: [edge] });
  }
  function handleSelectSubgraphs(threshold: SubgraphSelection) {
    setActiveSubgraph(threshold);
    setActiveHub(null);
    setSelection(selectSubgraphs(selectionIndex, threshold));
  }
  function handleSelectHubs(threshold: HubSelection) {
    setActiveSubgraph(null);
    setActiveHub(threshold);
    setSelection(selectHubs(selectionIndex, threshold));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      {data.isTruncated && (
        <Alert className="mb-2">
          <AlertTitle>
            Showing the first{" "}
            {interactionsGraphRowLimit.toLocaleString()} interactions
          </AlertTitle>
          <AlertDescription>
            This search matches more interactions than the graph can draw.
            Narrow it, or use the Table subview to see them all.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex w-60 shrink-0 flex-col rounded-tl-md border-x border-t bg-card">
          <div className="border-b p-3">
            <GraphLegend />
          </div>
          <div className="min-h-0 flex-1">
            <GraphNodeList
              nodes={nodes}
              selectedIds={selectedNodeIds}
              onSelectNode={selectNode}
            />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t">
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
                positions={layoutQuery.data ?? null}
                selection={selection}
                onSelect={(nextSelection) => {
                  clearActivePreset();
                  setSelection(nextSelection);
                }}
                handleRef={canvasHandleRef}
                onReady={() => {
                  setCanvasReady(true);
                }}
              />
            )}
            {layoutQuery.isFetching && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground"
              >
                Laying out…
              </div>
            )}
            {layoutQuery.isError && (
              <div className="absolute inset-x-0 top-0 z-10 p-2">
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
        </div>
        <div
          className="w-64 shrink-0 overflow-y-auto border-t border-l bg-card"
          tabIndex={0}
          aria-label="Selection details"
        >
          <GraphDetailPanel
            selection={selection}
            incidentEdges={incidentEdges}
            nodesById={nodesById}
            onSelectEdge={selectEdge}
          />
        </div>
      </div>
    </div>
  );
}

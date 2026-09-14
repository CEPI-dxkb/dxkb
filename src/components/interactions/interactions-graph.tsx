"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { defaultLayout } from "@/lib/interactions/renderer-capabilities";
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
  /**
   * The subview's scoping predicate, already normalized by the shell. The shared
   * keyword is NOT folded in here — it arrives as `keywordValue` and travels as
   * the request's own `keyword`, exactly as it does for the Table, so both views
   * resolve one input to one dataset.
   */
  rql: string;
  keywordValue: string;
  onKeywordChange: (value: string) => void;
}

export function InteractionsGraph({
  rql,
  keywordValue,
  onKeywordChange,
}: InteractionsGraphProps) {
  const { data, isPending, isError, error } = useInteractions(
    rql,
    keywordValue,
  );
  const [layout, setLayout] = useState<LayoutName>(defaultLayout);
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

  // React Compiler preserves these derived identities while their inputs are stable,
  // avoiding graph reloads when only selection state changes.
  const graph = toGraph(data?.rows ?? emptyRows);
  const selectionIndex = buildGraphSelectionIndex(graph.nodes, graph.edges);

  function handleLayoutChange(name: LayoutName) {
    setLayout(name);
    canvasHandleRef.current?.runLayout(name);
  }

  const toolbar = (
    <GraphToolbar filterValue={keywordValue} onFilterChange={onKeywordChange} />
  );

  // Toolbar (and its keyword box) renders in every state — including
  // loading/error/empty — so a keyword filter that matches nothing doesn't
  // strand the user without a way to see or clear it.
  if (isPending) {
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

  if (isError) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Failed to load interactions."}
        </div>
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
      {/* The row ceiling used to be a silent `Range` header: a query matching
          more interactions than the graph can draw looked like a complete
          answer. Say so, and point at the view that can show the rest. */}
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
            exportReady={canvasReady && nodes.length > 0}
          />
          {/* The WebGL canvases have no accessible role. Keep this wrapper exposed
              because SigmaCanvas also contains labeled, keyboard-operable zoom controls. */}
          <div className="min-h-0 flex-1">
            {nodes.length === 0 ? (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                No Interactions
              </div>
            ) : (
              <SigmaCanvas
                nodes={nodes}
                edges={edges}
                layout={layout}
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

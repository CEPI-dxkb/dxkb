"use client";

import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import { drawDiscNodeHover, EdgeRectangleProgram } from "sigma/rendering";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
import { downloadAsImage } from "@sigma/export-image";

import {
  colors,
  edgeHighlightReducer,
  nodeHighlightReducer,
  renderEdge,
  renderEdgeExperimental,
} from "@/lib/interactions/graph-theme";
import type {
  GEdge,
  GNode,
  GraphCanvasProps,
  GraphSelection,
} from "@/lib/interactions/types";

import { ZoomControl } from "./zoom-control";

function buildGraph(
  nodes: GNode[],
  edges: GEdge[],
  positions: Float64Array,
): Graph {
  const g = new Graph({ multi: true });
  nodes.forEach((n, i) => {
    g.addNode(n.id, {
      ...n,
      label: n.gene || n.id,
      // Small nodes so ~1,900 points don't overlap and tight clusters keep their edges visible.
      size: 2.5,
      color: n.kind === "host" ? colors.host : colors.microbial,
      x: positions[2 * i],
      y: positions[2 * i + 1],
    });
  });
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.addEdgeWithKey(e.id, e.source, e.target, {
        ...e,
        size: 1,
        // Translucent (premultiplied) edges accumulate into a density gradient; wider rectangles
        // give pointer events a usable hit target.
        color: e.experimental ? renderEdgeExperimental : renderEdge,
      });
    }
  }
  return g;
}

// Sigma's hover pill is hardcoded white, so force a dark label to stay readable in every theme.
// Module scope keeps its identity stable: SigmaContainer deep-diffs settings and resets pan/zoom if
// it changes.
const drawNodeHover: NodeHoverDrawingFunction = (context, data, settings) => {
  drawDiscNodeHover(context, data, {
    ...settings,
    labelColor: { color: "#000" },
  });
};

interface GraphLoaderProps {
  nodes: GNode[];
  edges: GEdge[];
  positions: Float64Array | null;
}

interface LoadedGraph extends GraphLoaderProps {
  sigma: ReturnType<typeof useSigma>;
}

// Positions arrive after nodes; new nodes clear the previous graph until their positions exist (so
// a failed layout never leaves a stale clickable graph), and new positions for the same nodes move
// them in place.
function GraphLoader({ nodes, edges, positions }: GraphLoaderProps) {
  const sigma = useSigma();
  const loadGraph = useLoadGraph();
  const loaded = useRef<LoadedGraph | null>(null);
  useEffect(() => {
    const previous = loaded.current;
    const sameGraph =
      previous?.sigma === sigma &&
      previous.nodes === nodes &&
      previous.edges === edges;
    if (positions?.length !== 2 * nodes.length) {
      if (previous !== null && !sameGraph) {
        loaded.current = null;
        sigma.getGraph().clear();
      }
      return;
    }
    loaded.current = { nodes, edges, positions, sigma };
    if (!sameGraph) {
      loadGraph(buildGraph(nodes, edges, positions));
      return;
    }
    if (previous.positions === positions) return;
    const graph = sigma.getGraph();
    nodes.forEach((node, i) => {
      graph.setNodeAttribute(node.id, "x", positions[2 * i]);
      graph.setNodeAttribute(node.id, "y", positions[2 * i + 1]);
    });
    sigma.refresh();
    // Sigma auto-frames only on initial load; reset the camera so a layout switch re-fits the new
    // extent.
    void sigma.getCamera().animatedReset();
  }, [nodes, edges, positions, loadGraph, sigma]);
  return null;
}

interface TooltipState {
  x: number;
  y: number;
  node?: GNode;
  edge?: GEdge;
}

interface GraphEventsProps {
  onSelect: (sel: GraphSelection) => void;
  onHover: (tooltip: TooltipState | null) => void;
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
}

function GraphEvents({
  onSelect,
  onHover,
  selectedNodeIds,
  selectedEdgeIds,
}: GraphEventsProps) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const select = useEffectEvent(onSelect);
  const hover = useEffectEvent(onHover);

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => {
        const data = sigma.getGraph().getNodeAttributes(node) as GNode;
        select({ nodes: [data], edges: [] });
      },
      clickEdge: ({ edge }) => {
        const data = sigma.getGraph().getEdgeAttributes(edge) as GEdge;
        select({ nodes: [], edges: [data] });
      },
      clickStage: () => {
        select({ nodes: [], edges: [] });
      },
      enterNode: ({ node, event }) => {
        const data = sigma.getGraph().getNodeAttributes(node) as GNode;
        hover({ x: event.x, y: event.y, node: data });
      },
      leaveNode: () => {
        hover(null);
      },
      enterEdge: ({ edge, event }) => {
        const data = sigma.getGraph().getEdgeAttributes(edge) as GEdge;
        hover({ x: event.x, y: event.y, edge: data });
        setHoveredEdge(edge);
      },
      leaveEdge: () => {
        hover(null);
        setHoveredEdge(null);
      },
    });
  }, [registerEvents, sigma]);

  useEffect(() => {
    setSettings({
      nodeReducer: nodeHighlightReducer(selectedNodeIds),
      edgeReducer: edgeHighlightReducer(selectedEdgeIds, hoveredEdge),
    });
  }, [setSettings, selectedNodeIds, selectedEdgeIds, hoveredEdge]);

  // Flat labels default to #000, invisible on the dark canvas. Canvas 2D can't parse var(), so
  // resolve --foreground and re-resolve on data-theme changes (observe the attribute: this effect
  // commits before next-themes' provider effect).
  useEffect(() => {
    const apply = () => {
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      if (color) setSettings({ labelColor: { color } });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
    };
  }, [setSettings]);

  return null;
}

function HandleBridge({
  handleRef,
  onReady,
}: {
  handleRef: GraphCanvasProps["handleRef"];
  onReady?: () => void;
}) {
  const sigma = useSigma();

  useImperativeHandle(
    handleRef,
    () => ({
      exportPng: () => {
        void downloadAsImage(sigma, { fileName: "BVBRC_interaction" });
      },
    }),
    [sigma],
  );

  // Runs after useImperativeHandle commits handleRef.current, so "ready" means the handle is
  // callable.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

export function SigmaCanvas({
  nodes,
  edges,
  positions,
  selection,
  onSelect,
  handleRef,
  onReady,
}: GraphCanvasProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const selectedNodeIds = new Set(selection.nodes.map((node) => node.id));
  const selectedEdgeIds = new Set(selection.edges.map((edge) => edge.id));

  return (
    <div className="relative size-full">
      <SigmaContainer
        className="size-full"
        // Match the "Search proteins" box: --graph-surface is the input/30-over-card composite,
        // whereas plain var(--card) is pure white in light themes.
        style={
          {
            "--sigma-background-color": "var(--graph-surface)",
          } as CSSProperties
        }
        settings={{
          renderEdgeLabels: false,
          // Sort draw order by zIndex so the selected element paints above the mesh (off by
          // default).
          zIndex: true,
          // Sigma ships only "line" and "arrow"; register the "rectangle" program or loadGraph
          // throws "could not find a suitable program for edge type rectangle".
          defaultEdgeType: "rectangle",
          edgeProgramClasses: { rectangle: EdgeRectangleProgram },
          enableEdgeEvents: true,
          defaultDrawNodeHover: drawNodeHover,
        }}
      >
        <GraphLoader nodes={nodes} edges={edges} positions={positions} />
        <GraphEvents
          onSelect={onSelect}
          onHover={setTooltip}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeIds={selectedEdgeIds}
        />
        <HandleBridge handleRef={handleRef} onReady={onReady} />
        <ZoomControl />
      </SigmaContainer>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md bg-primary px-2 py-1 text-xs text-background shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.node && (
            <>
              <div>{tooltip.node.id}</div>
              <div>{tooltip.node.genome}</div>
              <div>{tooltip.node.refseqLocusTag}</div>
              <div>{tooltip.node.gene}</div>
              <div>{tooltip.node.interactorDesc}</div>
            </>
          )}
          {tooltip.edge && (
            <>
              <div>{tooltip.edge.interactionType}</div>
              <div>{tooltip.edge.detectionMethod}</div>
              <div>{tooltip.edge.evidence}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
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
import { runGraphLayout } from "@/lib/interactions/layouts";
import type {
  GEdge,
  GNode,
  GraphCanvasProps,
  GraphSelection,
  LayoutName,
} from "@/lib/interactions/types";

import { ZoomControl } from "./zoom-control";

function buildGraph(nodes: GNode[], edges: GEdge[]): Graph {
  const g = new Graph({ multi: true });
  for (const n of nodes) {
    g.addNode(n.id, {
      ...n,
      label: n.gene || n.id,
      // Small nodes so ~1,900 points don't overlap when zoomed out, and so the
      // connecting edges of tight 2–4 node clusters stay visible at any zoom.
      size: 2.5,
      color: n.kind === "host" ? colors.host : colors.microbial,
      x: Math.random(),
      y: Math.random(),
    });
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.addEdgeWithKey(e.id, e.source, e.target, {
        ...e,
        size: 1,
        // Translucent (premultiplied) so ~4,400 overlapping edges read as
        // individual threads and accumulate into a density gradient instead of a
        // solid disk. Derived from the theme in graph-theme.ts so dense-region
        // color matches the legend swatches; see renderEdge for the alpha/
        // premultiply rationale. Wider rectangle edges give pointer events a
        // usable hit target without making the mesh opaque.
        color: e.experimental ? renderEdgeExperimental : renderEdge,
      });
    }
  }
  return g;
}

// Sigma's hover renderer (drawDiscNodeHover) paints a hardcoded #FFF pill, then
// draws the label in `labelColor`. Since we drive labelColor off the theme
// foreground (white in dark mode), the hover/selected label went white-on-white.
// Force the pill's label dark so it's readable on the always-white pill in every
// theme, while flat (non-hovered) labels keep their theme-aware color. Declared
// at module scope so its identity is stable — SigmaContainer deep-diffs settings
// and recreates the instance (resetting pan/zoom) if this changed each render.
const drawNodeHover: NodeHoverDrawingFunction = (context, data, settings) => {
  drawDiscNodeHover(context, data, {
    ...settings,
    labelColor: { color: "#000" },
  });
};

interface GraphLoaderProps {
  nodes: GNode[];
  edges: GEdge[];
  layout: LayoutName;
}

function GraphLoader({ nodes, edges, layout }: GraphLoaderProps) {
  const loadGraph = useLoadGraph();
  useEffect(() => {
    const g = buildGraph(nodes, edges);
    runGraphLayout(g, layout);
    loadGraph(g);
    // Layout is intentionally excluded: the imperative handle's runLayout
    // re-runs the layout in place via useSigma, without reloading the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, loadGraph]);
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

  // Sigma's flat node labels default to labelColor #000 — invisible on the dark
  // canvas (the selected label rides its own white hover-pill, so it stayed
  // legible). Drive labelColor off the theme's --foreground. Canvas 2D can't
  // parse var(), so resolve the computed value; re-resolve on data-theme changes
  // (next-themes toggles that attribute, and this effect commits before its
  // provider effect, so observe the attribute rather than a theme prop).
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
      runLayout: (name) => {
        const g = sigma.getGraph();
        runGraphLayout(g, name);
        sigma.refresh();
        // Sigma auto-frames only on initial load. Switching layout in place can
        // shift the graph's normalized extent (packed layouts especially), so
        // reset the camera to re-fit the new positions instead of leaving it
        // panned/zoomed to the previous layout.
        void sigma.getCamera().animatedReset();
      },
      exportPng: () => {
        void downloadAsImage(sigma, { fileName: "BVBRC_interaction" });
      },
    }),
    [sigma],
  );

  // Runs after useImperativeHandle's layout effect commits handleRef.current,
  // so the parent only learns "ready" once the handle is actually callable.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

export function SigmaCanvas({
  nodes,
  edges,
  layout,
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
        // react-sigma paints the container div with --sigma-background-color
        // (default #fff) behind its transparent WebGL canvases. Match the
        // "Search proteins" box (bg-input/30 over the bg-card column) so the
        // canvas reads as the same surface: --graph-surface in globals.css is
        // that input/30-over-card composite. Plain var(--card) fails in light
        // themes where --card is pure white — the composite never is.
        style={
          {
            "--sigma-background-color": "var(--graph-surface)",
          } as CSSProperties
        }
        settings={{
          renderEdgeLabels: false,
          // Sort draw order by node/edge zIndex so the reducer's zIndex:1 on the
          // selected element paints it above the ~1,900-node mesh. Off by default,
          // which left the selection buried under later-inserted neighbors.
          zIndex: true,
          // "rectangle" (thick, hit-testable edges) isn't auto-registered — Sigma
          // only ships "line" and "arrow" by default — so register the program
          // for that type key here, or loadGraph throws "could not find a suitable
          // program for edge type rectangle".
          defaultEdgeType: "rectangle",
          edgeProgramClasses: { rectangle: EdgeRectangleProgram },
          enableEdgeEvents: true,
          defaultDrawNodeHover: drawNodeHover,
        }}
      >
        <GraphLoader nodes={nodes} edges={edges} layout={layout} />
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

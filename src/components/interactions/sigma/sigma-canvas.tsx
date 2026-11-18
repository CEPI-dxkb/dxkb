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
import Graph, { MultiGraph } from "graphology";
import { drawDiscNodeHover, EdgeRectangleProgram } from "sigma/rendering";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
import type {
  SigmaEdgeEventPayload,
  SigmaEventPayload,
  SigmaNodeEventPayload,
  SigmaStageEventPayload,
} from "sigma/types";
import { downloadAsImage } from "@sigma/export-image";

import {
  colors,
  edgeHighlightReducer,
  nodeHighlightReducer,
  renderEdge,
  renderEdgeExperimental,
} from "@/lib/interactions/graph-theme";
import {
  applySelectionClick,
  computeSelectionFocus,
  isAdditiveClick,
  type SelectionFocus,
  type SelectionTarget,
} from "@/lib/interactions/selection-focus";
import type {
  GEdge,
  GNode,
  GraphCameraView,
  GraphCanvasProps,
  GraphSelection,
} from "@/lib/interactions/types";
import { cameraUrlView } from "@/lib/interactions/url-state";

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
  camera: GraphCameraView | null;
}

type Sigma = ReturnType<typeof useSigma>;

interface LoadedGraph extends Omit<GraphLoaderProps, "camera"> {
  sigma: Sigma;
}

const defaultCameraState = { x: 0.5, y: 0.5, ratio: 1, angle: 0 };

/**
 * A Sigma instance's first load takes the URL's camera (Back or a reload); a later load into the
 * same instance is new rows, for which an old camera means nothing, so it re-fits. Keyed by
 * instance because `SigmaContainer` copies the previous instance's camera onto a recreated one
 * (Strict Mode, a settings change); the URL's camera is applied over that copy, and a first load
 * with none resets it to the default.
 */
function frameLoadedGraph(
  sigma: Sigma,
  restore: GraphCameraView | null,
): void {
  const camera = sigma.getCamera();
  if (restore === null) {
    camera.setState(defaultCameraState);
    return;
  }
  camera.setState({
    ratio: camera.getBoundedRatio(restore.ratio),
    x: restore.x,
    y: restore.y,
  });
}

// Positions arrive after nodes; new nodes clear the previous graph until their positions exist (so
// a failed layout never leaves a stale clickable graph), and new positions for the same nodes move
// them in place.
function GraphLoader({ nodes, edges, positions, camera }: GraphLoaderProps) {
  const sigma = useSigma();
  const loadGraph = useLoadGraph();
  const loaded = useRef<LoadedGraph | null>(null);
  const framedSigmaRef = useRef<Sigma | null>(null);
  // Read at load time, not a dependency: the URL's camera changes as the user moves.
  const restoreCamera = useEffectEvent(() =>
    framedSigmaRef.current === sigma ? null : camera,
  );
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
      frameLoadedGraph(sigma, restoreCamera());
      framedSigmaRef.current = sigma;
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

const cameraWriteDelayMs = 250;

/** The page and tab a camera report belongs to; the report is dropped if either has changed. */
function cameraReportScope(): string {
  const { pathname, search } = window.location;
  return `${pathname}?tab=${new URLSearchParams(search).get("tab") ?? ""}`;
}

/**
 * Sigma emits "updated" every frame of a pan or zoom, so this reports only once the camera rests.
 * Unmounting cancels a pending report rather than flushing it: after a link click it would land on
 * the next page's URL. Next pushes that URL during commit, before this effect's cleanup runs, so a
 * timer that falls due in between is dropped by comparing the page and tab it was scheduled on.
 */
function CameraReporter({
  onCameraChange,
}: {
  onCameraChange?: (camera: GraphCameraView | null) => void;
}) {
  const sigma = useSigma();
  const report = useEffectEvent((camera: GraphCameraView | null) => {
    onCameraChange?.(camera);
  });
  useEffect(() => {
    const camera = sigma.getCamera();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      const scope = cameraReportScope();
      timer = setTimeout(() => {
        if (cameraReportScope() !== scope) return;
        report(cameraUrlView(camera.getState()));
      }, cameraWriteDelayMs);
    };
    camera.on("updated", update);
    return () => {
      camera.off("updated", update);
      clearTimeout(timer);
    };
  }, [sigma]);
  return null;
}

interface TooltipState {
  x: number;
  y: number;
  node?: GNode;
  edge?: GEdge;
}

// Sigma turns a second click inside its double-click window into `doubleClick*` (never `click*`)
// and zooms. A quick Cmd/Ctrl pair must still toggle twice, so an additive double-click is handled
// as a click with sigma's zoom suppressed; a plain double-click keeps zooming. Sigma's drag check
// (`draggedEvents`) applies only to `click`, so a Cmd press-drag-release within 300 ms of a
// Cmd-click arrives as `doubleClick*` and toggles; accepted.
function additiveDoubleClick<P extends SigmaEventPayload>(
  handler: (payload: P) => void,
) {
  return (payload: P) => {
    if (!isAdditiveClick(payload.event.original)) return;
    payload.preventSigmaDefault();
    handler(payload);
  };
}

interface GraphEventsProps {
  onSelect: (sel: GraphSelection) => void;
  onHover: (tooltip: TooltipState | null) => void;
  selection: GraphSelection;
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  focus: SelectionFocus | null;
}

function GraphEvents({
  onSelect,
  onHover,
  selection,
  selectedNodeIds,
  selectedEdgeIds,
  focus,
}: GraphEventsProps) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  // An Effect Event reads the latest selection, so the handlers registered once below toggle
  // against what is selected now.
  const click = useEffectEvent(
    (target: SelectionTarget | null, original: MouseEvent | TouchEvent) => {
      const additive = isAdditiveClick(original);
      if (target === null) {
        // A Cmd/Ctrl-click that misses every node and edge must not wipe a multi-selection.
        if (!additive) onSelect({ nodes: [], edges: [] });
        return;
      }
      onSelect(applySelectionClick(selection, target, additive));
    },
  );
  const hover = useEffectEvent(onHover);

  useEffect(() => {
    const clickNode = ({ node, event }: SigmaNodeEventPayload) => {
      const data = sigma.getGraph().getNodeAttributes(node) as GNode;
      click({ kind: "node", node: data }, event.original);
    };
    const clickEdge = ({ edge, event }: SigmaEdgeEventPayload) => {
      const data = sigma.getGraph().getEdgeAttributes(edge) as GEdge;
      click({ kind: "edge", edge: data }, event.original);
    };
    const clickStage = ({ event }: SigmaStageEventPayload) => {
      click(null, event.original);
    };
    registerEvents({
      clickNode,
      clickEdge,
      clickStage,
      doubleClickNode: additiveDoubleClick(clickNode),
      doubleClickEdge: additiveDoubleClick(clickEdge),
      doubleClickStage: additiveDoubleClick(clickStage),
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
      nodeReducer: nodeHighlightReducer(selectedNodeIds, focus),
      edgeReducer: edgeHighlightReducer(selectedEdgeIds, hoveredEdge, focus),
    });
  }, [setSettings, selectedNodeIds, selectedEdgeIds, hoveredEdge, focus]);

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
  incidence,
  positions,
  selection,
  onSelect,
  handleRef,
  onReady,
  camera = null,
  onCameraChange,
}: GraphCanvasProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const selectedNodeIds = new Set(selection.nodes.map((node) => node.id));
  const selectedEdgeIds = new Set(selection.edges.map((edge) => edge.id));
  const focus = computeSelectionFocus(incidence, selection);

  return (
    <div className="relative size-full">
      <SigmaContainer
        // `loadGraph` imports into the container's own graph, which defaults to a non-multi
        // `new Graph()` and throws on a second edge between the same pair (two experimental PPI
        // rows for one feature pair). A module-scope constructor keeps the prop's identity stable.
        graph={MultiGraph}
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
        <CameraReporter onCameraChange={onCameraChange} />
        <GraphLoader
          nodes={nodes}
          edges={edges}
          positions={positions}
          camera={camera}
        />
        <GraphEvents
          onSelect={onSelect}
          onHover={setTooltip}
          selection={selection}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeIds={selectedEdgeIds}
          focus={focus}
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

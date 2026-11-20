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
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph, { MultiGraph } from "graphology";
import type {
  SigmaEdgeEventPayload,
  SigmaEventPayload,
  SigmaNodeEventPayload,
  SigmaOptions,
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
import { cameraUrlView, liveTabScope } from "@/lib/interactions/url-state";

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

// Sigma 4 fixes `nodeReducer`/`edgeReducer` at construction (`setSettings` no longer takes them), and
// `SigmaContainer` rebuilds the whole instance when `options` changes. So the reducers are installed
// once and read what is selected, hovered and focused from this ref, which `GraphEvents` updates
// before asking Sigma to refresh. (A closure store, not a ref: the React Compiler lint rejects
// passing a ref into the `options` builder and writing `.current` of a prop.)
interface HighlightInputs {
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  hoveredEdge: string | null;
  focus: SelectionFocus | null;
  labelColor: string;
}

function createHighlightStore() {
  let inputs: HighlightInputs = {
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredEdge: null,
    focus: null,
    labelColor: "#000",
  };
  return {
    get: () => inputs,
    set: (patch: Partial<HighlightInputs>) => {
      inputs = { ...inputs, ...patch };
    },
  };
}

type HighlightStore = ReturnType<typeof createHighlightStore>;

// Sigma's hover backdrop is white, so a hovered label is forced dark to stay readable in every theme.
const hoverLabelColor = "#000";

function buildSigmaOptions(inputs: HighlightStore): Partial<SigmaOptions> {
  return {
    settings: { renderEdgeLabels: false, enableEdgeEvents: true },
    nodeReducer: (node, data, _attrs, state) => {
      const { selectedNodeIds, focus, labelColor } = inputs.get();
      return {
        ...nodeHighlightReducer(selectedNodeIds, focus)(node, data),
        labelColor: state.isHovered ? hoverLabelColor : labelColor,
      };
    },
    edgeReducer: (edge, data, attrs) => {
      const { selectedEdgeIds, hoveredEdge, focus } = inputs.get();
      return edgeHighlightReducer(
        selectedEdgeIds,
        hoveredEdge,
        focus,
      )(edge, { ...data, experimental: attrs.experimental as boolean });
    },
  };
}

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
    void sigma.getCamera().reset();
  }, [nodes, edges, positions, loadGraph, sigma]);
  return null;
}

// How long the container must hold its size before the label grid is rebuilt.
const resizeSettleMs = 150;

// Sigma's synchronous render without reprocessing: it re-measures the container, resizes its
// canvases and draws, and (an empty partial graph, indexation skipped) re-indexes no node or edge.
// `render` itself is private in Sigma's types.
const redrawOptions = {
  partialGraph: { nodes: [], edges: [] },
  skipIndexation: true,
};

/**
 * Sigma re-measures its container only when it renders, and renders for a window resize alone, so
 * a column dragged wider or narrower would leave the canvas at its old size. This redraws whenever
 * the container changes size. A container with no size (a hidden tab) is skipped: Sigma throws when
 * it measures one.
 *
 * The redraw is synchronous: a ResizeObserver callback runs after layout and before paint, so the
 * frame that shows the new size already holds a canvas drawn for it. A scheduled refresh (what the
 * window listener does) would paint the old bitmap for one frame against the new box, so a column
 * drag made the nodes lag and snap, and it re-indexes every node and edge each time. Only the
 * label grid, which a plain redraw leaves for the old size, is rebuilt, once the size has settled.
 */
function ContainerResizeSync() {
  const sigma = useSigma();
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const container = sigma.getContainer();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
      sigma.refresh(redrawOptions);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        sigma.scheduleRefresh();
      }, resizeSettleMs);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(settleTimer);
    };
  }, [sigma]);
  return null;
}

const cameraWriteDelayMs = 250;

/** The page and tab a camera report belongs to; the report is dropped if either has changed. */

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
      const scope = liveTabScope();
      timer = setTimeout(() => {
        if (liveTabScope() !== scope) return;
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
// as a click with sigma's zoom suppressed; a plain double-click keeps zooming. Sigma applies its
// drag check (`draggedEvents`) only to `click`, so a Cmd press-drag-release within 300 ms of a
// Cmd-click also arrives as `doubleClick*`: it is told apart by how far the pointer moved from
// where it was pressed, and a drag neither toggles nor zooms.
const dragTolerancePx = 4;

interface PressPoint {
  x: number;
  y: number;
}

function additiveDoubleClick<P extends SigmaEventPayload>(
  handler: (payload: P) => void,
  pressedAt: () => PressPoint | null,
) {
  return (payload: P) => {
    if (!isAdditiveClick(payload.event.original)) return;
    payload.preventSigmaDefault();
    const pressed = pressedAt();
    if (
      pressed &&
      Math.hypot(payload.event.x - pressed.x, payload.event.y - pressed.y) >
        dragTolerancePx
    ) {
      return;
    }
    handler(payload);
  };
}

interface GraphEventsProps {
  highlight: HighlightStore;
  onSelect: (sel: GraphSelection) => void;
  onHover: (tooltip: TooltipState | null) => void;
  selection: GraphSelection;
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  focus: SelectionFocus | null;
}

function GraphEvents({
  highlight,
  onSelect,
  onHover,
  selection,
  selectedNodeIds,
  selectedEdgeIds,
  focus,
}: GraphEventsProps) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
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
    let pressed: PressPoint | null = null;
    const press = ({ event }: SigmaEventPayload) => {
      pressed = { x: event.x, y: event.y };
    };
    const pressedAt = () => pressed;
    registerEvents({
      clickNode,
      clickEdge,
      clickStage,
      downNode: press,
      downEdge: press,
      downStage: press,
      doubleClickNode: additiveDoubleClick(clickNode, pressedAt),
      doubleClickEdge: additiveDoubleClick(clickEdge, pressedAt),
      doubleClickStage: additiveDoubleClick(clickStage, pressedAt),
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
    highlight.set({ selectedNodeIds, selectedEdgeIds, hoveredEdge, focus });
    sigma.scheduleRefresh();
  }, [sigma, highlight, selectedNodeIds, selectedEdgeIds, hoveredEdge, focus]);

  // Flat labels default to #000, invisible on the dark canvas. Canvas 2D can't parse var(), so
  // resolve --foreground and re-resolve on data-theme changes (observe the attribute: this effect
  // commits before next-themes' provider effect).
  useEffect(() => {
    const apply = () => {
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      if (color) {
        highlight.set({ labelColor: color });
        sigma.scheduleRefresh();
      }
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
  }, [sigma, highlight]);

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
  const [highlight] = useState(createHighlightStore);
  const [sigmaOptions] = useState(() => buildSigmaOptions(highlight));
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
        options={sigmaOptions}
      >
        <ContainerResizeSync />
        <CameraReporter onCameraChange={onCameraChange} />
        <GraphLoader
          nodes={nodes}
          edges={edges}
          positions={positions}
          camera={camera}
        />
        <GraphEvents
          highlight={highlight}
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

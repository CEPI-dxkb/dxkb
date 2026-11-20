// jsdom has no WebGL2, and Sigma 4 reads `WebGL2RenderingContext` constants when its modules load
// (the canvas imports its style rules from them).
vi.hoisted(() => {
  globalThis.WebGL2RenderingContext = {
    BOOL: 0x8b56,
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    HALF_FLOAT: 0x140b,
  } as never;
});

import { act, render, waitFor } from "@testing-library/react";
import Graph from "graphology";
import { useState, type ReactNode } from "react";

import { SigmaCanvas } from "../sigma/sigma-canvas";
import type { GEdge, GNode, GraphCanvasProps } from "@/lib/interactions/types";
import type { GraphSigmaOptions } from "@/lib/interactions/graph-render-config";
import { buildIncidenceIndex } from "@/lib/interactions/selection-focus";

// Sigma needs WebGL; its React bindings are stubbed over a real graphology graph so GraphLoader's
// load-vs-move choice is observable.
const sigmaStub = vi.hoisted(() => ({
  graph: null as Graph | null,
  refresh: vi.fn(),
  scheduleRefresh: vi.fn(),
  setNodeState: vi.fn(),
  setEdgeState: vi.fn(),
  setNodesState: vi.fn(),
  setEdgesState: vi.fn(),
  container: null as HTMLElement | null,
  reset: vi.fn(() => Promise.resolve()),
  loadGraph: vi.fn(),
  registerEvents: vi.fn(),
  dimensions: { width: 400, height: 300 },
  // The `options` the container was built with, and those it was given on every render.
  options: null as GraphSigmaOptions | null,
  optionsSeen: [] as (GraphSigmaOptions | undefined)[],
}));

// Sigma's camera: `setState` emits "updated" synchronously, as the real one does.
const cameraStub = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const camera = {
    state: { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
    listeners,
    getState: () => ({ ...camera.state }),
    setState: vi.fn((next: Partial<typeof camera.state>) => {
      camera.state = { ...camera.state, ...next };
      listeners.forEach((listener) => {
        listener();
      });
    }),
    getBoundedRatio: vi.fn((ratio: number) => ratio),
    on: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    off: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  return camera;
});

vi.mock("@react-sigma/core", () => {
  const sigma = {
    getGraph: () => sigmaStub.graph,
    refresh: sigmaStub.refresh,
    scheduleRefresh: sigmaStub.scheduleRefresh,
    setNodeState: sigmaStub.setNodeState,
    setEdgeState: sigmaStub.setEdgeState,
    setNodesState: sigmaStub.setNodesState,
    setEdgesState: sigmaStub.setEdgesState,
    getContainer: () => sigmaStub.container,
    getDimensions: () => sigmaStub.dimensions,
    getCamera: () =>
      Object.assign(cameraStub, { reset: sigmaStub.reset }),
  };
  return {
    // The real container builds its graph from the `graph` prop (a constructor), else a plain
    // non-multi `new Graph()`; mirroring that keeps a missing `graph` prop from passing silently.
    SigmaContainer: ({
      children,
      graph,
      options,
    }: {
      children: ReactNode;
      graph?: new () => Graph;
      options?: GraphSigmaOptions;
    }) => {
      useState(() => {
        sigmaStub.graph = graph ? new graph() : new Graph();
        sigmaStub.options = options ?? null;
      });
      sigmaStub.optionsSeen.push(options);
      return <>{children}</>;
    },
    useSigma: () => sigma,
    useLoadGraph: () => sigmaStub.loadGraph,
    useRegisterEvents: () => sigmaStub.registerEvents,
  };
});
vi.mock("../sigma/zoom-control", () => ({ ZoomControl: () => null }));
vi.mock("@sigma/export-image", () => ({ downloadAsImage: vi.fn() }));

function loadedGraph(): Graph {
  return sigmaStub.graph as Graph;
}

const nodes: GNode[] = [
  { id: "a", kind: "microbial" },
  { id: "b", kind: "host" },
];
const edges: GEdge[] = [
  {
    id: "a-b",
    source: "a",
    target: "b",
    evidence: "",
    interactionType: "",
    detectionMethod: "",
    experimental: false,
  },
];

function canvas(props: Partial<GraphCanvasProps>) {
  const canvasEdges = props.edges ?? edges;
  return (
    <SigmaCanvas
      nodes={nodes}
      edges={edges}
      incidence={buildIncidenceIndex(canvasEdges)}
      positions={null}
      selection={{ nodes: [], edges: [] }}
      onSelect={vi.fn()}
      handleRef={{ current: null }}
      {...props}
    />
  );
}

function position(graph: Graph, id: string): number[] {
  return [
    graph.getNodeAttribute(id, "x") as number,
    graph.getNodeAttribute(id, "y") as number,
  ];
}

beforeEach(() => {
  sigmaStub.dimensions = { width: 400, height: 300 };
  cameraStub.state = { x: 0.5, y: 0.5, ratio: 1, angle: 0 };
  cameraStub.listeners.clear();
  cameraStub.getBoundedRatio.mockImplementation((ratio: number) => ratio);
  sigmaStub.graph = null;
  sigmaStub.optionsSeen = [];
  sigmaStub.container = document.createElement("div");
  sigmaStub.loadGraph.mockImplementation((graph: Graph) => {
    loadedGraph().clear();
    loadedGraph().import(graph);
  });
  // jsdom has no 2D canvas either; the label color then falls back to a fixed hex.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SigmaCanvas container size", () => {
  let observed: (() => void) | null = null;
  const disconnect = vi.fn();

  beforeEach(() => {
    observed = null;
    disconnect.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed = callback;
        }
        observe = () => undefined;
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sizeContainer(width: number, height: number) {
    Object.defineProperty(sigmaStub.container, "offsetWidth", {
      configurable: true,
      value: width,
    });
    Object.defineProperty(sigmaStub.container, "offsetHeight", {
      configurable: true,
      value: height,
    });
  }

  // These tests count only the refreshes the container's size causes.
  function renderCanvas() {
    const result = render(canvas({}));
    sigmaStub.scheduleRefresh.mockClear();
    return result;
  }

  // Sigma's synchronous redraw: an empty partial graph with indexation skipped.
  const redraw = {
    partialGraph: { nodes: [], edges: [] },
    skipIndexation: true,
  };

  it("redraws at once when its container changes size, without re-indexing the graph", () => {
    renderCanvas();
    sizeContainer(400, 300);

    observed?.();

    // A ResizeObserver callback runs before paint, so the redraw must be synchronous (a scheduled
    // refresh paints the old bitmap for a frame) and must not re-index every node and edge.
    expect(sigmaStub.refresh).toHaveBeenCalledTimes(1);
    expect(sigmaStub.refresh).toHaveBeenCalledWith(redraw);
    expect(sigmaStub.scheduleRefresh).not.toHaveBeenCalled();
  });

  it("rebuilds the label grid once, after the size has settled", () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      sizeContainer(400, 300);

      observed?.();
      vi.advanceTimersByTime(100);
      observed?.();
      vi.advanceTimersByTime(100);
      // Two redraws, and the settle timer restarted by the second: 100 ms after it, still waiting.
      expect(sigmaStub.refresh).toHaveBeenCalledTimes(2);
      expect(sigmaStub.scheduleRefresh).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(sigmaStub.scheduleRefresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves a container with no size alone, because Sigma throws measuring one", () => {
    renderCanvas();
    sizeContainer(0, 0);

    observed?.();

    expect(sigmaStub.refresh).not.toHaveBeenCalled();
    expect(sigmaStub.scheduleRefresh).not.toHaveBeenCalled();
  });

  it("drops a pending label-grid rebuild when the canvas unmounts", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderCanvas();
      sizeContainer(400, 300);
      observed?.();

      unmount();
      vi.advanceTimersByTime(1000);

      expect(sigmaStub.scheduleRefresh).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops watching when the canvas unmounts", () => {
    const { unmount } = render(canvas({}));

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});

describe("SigmaCanvas graph loading", () => {
  it("keeps parallel edges between the same pair of nodes", () => {
    // Two experimental PPI rows can link one feature pair (different detection methods).
    const parallel: GEdge[] = [
      ...edges,
      { ...edges[0], id: "a-b-second", detectionMethod: "two hybrid" },
    ];

    render(
      canvas({
        edges: parallel,
        positions: new Float64Array([1, 2, 3, 4]),
      }),
    );

    expect(loadedGraph().hasEdge("a-b")).toBe(true);
    expect(loadedGraph().hasEdge("a-b-second")).toBe(true);
    expect(loadedGraph().size).toBe(2);
  });

  it("loads nothing until positions for these exact nodes arrive", () => {
    const { rerender } = render(canvas({ positions: null }));
    expect(sigmaStub.loadGraph).not.toHaveBeenCalled();

    rerender(canvas({ positions: new Float64Array([1, 2, 3, 4, 5, 6]) }));
    expect(sigmaStub.loadGraph).not.toHaveBeenCalled();

    rerender(canvas({ positions: new Float64Array([1, 2, 3, 4]) }));

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    expect(position(loadedGraph(), "a")).toEqual([1, 2]);
    expect(position(loadedGraph(), "b")).toEqual([3, 4]);
    expect(loadedGraph().hasEdge("a-b")).toBe(true);
  });

  it("moves the loaded nodes in place on a layout switch, then re-fits the camera", () => {
    const { rerender } = render(
      canvas({ positions: new Float64Array([1, 2, 3, 4]) }),
    );
    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    const graph = loadedGraph();

    rerender(canvas({ positions: new Float64Array([10, 20, 30, 40]) }));

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    expect(loadedGraph()).toBe(graph);
    expect(position(graph, "a")).toEqual([10, 20]);
    expect(position(graph, "b")).toEqual([30, 40]);
    expect(sigmaStub.refresh).toHaveBeenCalledTimes(1);
    expect(sigmaStub.reset).toHaveBeenCalledTimes(1);
  });

  it("does nothing when a re-render brings the same positions", () => {
    const positions = new Float64Array([1, 2, 3, 4]);
    const { rerender } = render(canvas({ positions }));

    rerender(canvas({ positions, selection: { nodes: [nodes[0]], edges: [] } }));

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    expect(sigmaStub.refresh).not.toHaveBeenCalled();
    expect(sigmaStub.reset).not.toHaveBeenCalled();
  });

  it("loads a new graph for new nodes", () => {
    const { rerender } = render(
      canvas({ positions: new Float64Array([1, 2, 3, 4]) }),
    );

    const nextNodes: GNode[] = [{ id: "c", kind: "microbial" }];
    rerender(
      canvas({
        nodes: nextNodes,
        edges: [],
        positions: new Float64Array([5, 6]),
      }),
    );

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(2);
    expect(loadedGraph().nodes()).toEqual(["c"]);
    expect(position(loadedGraph(), "c")).toEqual([5, 6]);
    expect(sigmaStub.reset).not.toHaveBeenCalled();
  });

  it("clears the previous graph while new nodes wait for their positions", () => {
    const { rerender } = render(
      canvas({ positions: new Float64Array([1, 2, 3, 4]) }),
    );
    expect(loadedGraph().order).toBe(2);

    const nextNodes: GNode[] = [{ id: "c", kind: "microbial" }];
    rerender(canvas({ nodes: nextNodes, edges: [], positions: null }));

    expect(loadedGraph().order).toBe(0);
    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);

    rerender(
      canvas({
        nodes: nextNodes,
        edges: [],
        positions: new Float64Array([5, 6]),
      }),
    );

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(2);
    expect(loadedGraph().nodes()).toEqual(["c"]);
    expect(position(loadedGraph(), "c")).toEqual([5, 6]);
  });

  it("keeps the loaded graph when a re-render of the same nodes has no positions", () => {
    const { rerender } = render(
      canvas({ positions: new Float64Array([1, 2, 3, 4]) }),
    );

    rerender(canvas({ positions: null }));

    expect(loadedGraph().order).toBe(2);
    expect(position(loadedGraph(), "a")).toEqual([1, 2]);
  });
});

type Handler = (payload: unknown) => void;

function handlers(): Record<string, Handler> {
  const call = sigmaStub.registerEvents.mock.calls.at(-1);
  if (!call) throw new Error("SigmaCanvas registered no events");
  return call[0] as Record<string, Handler>;
}

type StateStub = typeof sigmaStub.setNodeState;

/**
 * The state the canvas has written on a node or edge, merged in call order the way Sigma merges
 * partial states: single writes (`setNodeState`) and batches (`setNodesState`) alike.
 */
function writtenState(
  single: StateStub,
  batch: StateStub,
  id: string,
): Record<string, boolean> {
  const writes = [
    ...single.mock.calls.map(([key, state], i) => ({
      keys: [key as string],
      state: state as Record<string, boolean>,
      at: single.mock.invocationCallOrder[i],
    })),
    ...batch.mock.calls.map(([keys, state], i) => ({
      keys: keys as string[],
      state: state as Record<string, boolean>,
      at: batch.mock.invocationCallOrder[i],
    })),
  ].sort((a, b) => a.at - b.at);
  return writes
    .filter(({ keys }) => keys.includes(id))
    .reduce((merged, { state }) => ({ ...merged, ...state }), {});
}

function nodeState(id: string) {
  return writtenState(sigmaStub.setNodeState, sigmaStub.setNodesState, id);
}

function edgeState(id: string) {
  return writtenState(sigmaStub.setEdgeState, sigmaStub.setEdgesState, id);
}

/** Every key the canvas has written state on, one by one or in a batch. */
function writtenKeys(): string[] {
  return [
    ...sigmaStub.setNodeState.mock.calls.map(([key]) => key as string),
    ...sigmaStub.setEdgeState.mock.calls.map(([key]) => key as string),
    ...sigmaStub.setNodesState.mock.calls.flatMap(([keys]) => keys as string[]),
    ...sigmaStub.setEdgesState.mock.calls.flatMap(([keys]) => keys as string[]),
  ];
}

/** Lets the dim batch a selection schedules (after its first frame) land. */
async function flushDimBatch() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

function clearStateWrites() {
  sigmaStub.setNodeState.mockClear();
  sigmaStub.setEdgeState.mockClear();
  sigmaStub.setNodesState.mockClear();
  sigmaStub.setEdgesState.mockClear();
}

function nodeClick(
  node: string,
  modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {},
) {
  return {
    node,
    event: { original: { metaKey: false, ctrlKey: false, ...modifiers } },
    preventSigmaDefault: vi.fn(),
  };
}

function stageClick(modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}) {
  return {
    event: { original: { metaKey: false, ctrlKey: false, ...modifiers } },
    preventSigmaDefault: vi.fn(),
  };
}

const quad: GNode[] = [
  { id: "a", kind: "microbial" },
  { id: "b", kind: "host" },
  { id: "c", kind: "microbial" },
  { id: "d", kind: "microbial" },
];
const quadEdges: GEdge[] = [
  { ...edges[0] },
  { ...edges[0], id: "c-d", source: "c", target: "d" },
];
const quadPositions = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);

function renderQuad(props: Partial<GraphCanvasProps> = {}) {
  return render(
    canvas({
      nodes: quad,
      edges: quadEdges,
      positions: quadPositions,
      ...props,
    }),
  );
}

describe("SigmaCanvas selection clicks", () => {
  it("replaces the selection on a plain node click", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect, selection: { nodes: [quad[2]], edges: [] } });

    handlers().clickNode(nodeClick("a"));

    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "a" })],
      edges: [],
    });
  });

  it("adds to the selection on a Cmd-click", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect, selection: { nodes: [quad[2]], edges: [] } });

    handlers().clickNode(nodeClick("a", { metaKey: true }));

    expect(onSelect).toHaveBeenCalledWith({
      nodes: [
        expect.objectContaining({ id: "c" }),
        expect.objectContaining({ id: "a" }),
      ],
      edges: [],
    });
  });

  it("removes an already-selected node on a Ctrl-click", () => {
    const onSelect = vi.fn();
    renderQuad({
      onSelect,
      selection: { nodes: [quad[0], quad[2]], edges: [] },
    });

    handlers().clickNode(nodeClick("a", { ctrlKey: true }));

    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "c" })],
      edges: [],
    });
  });

  it("toggles an edge on a Cmd-click without dropping the selected nodes", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect, selection: { nodes: [quad[0]], edges: [] } });

    handlers().clickEdge({
      edge: "c-d",
      event: { original: { metaKey: true, ctrlKey: false } },
      preventSigmaDefault: vi.fn(),
    });

    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "a" })],
      edges: [expect.objectContaining({ id: "c-d" })],
    });
  });

  it("clears on a plain stage click but a Cmd-click on empty stage keeps the selection", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect, selection: { nodes: [quad[0]], edges: [] } });

    handlers().clickStage(stageClick({ metaKey: true }));
    expect(onSelect).not.toHaveBeenCalled();

    handlers().clickStage(stageClick());
    expect(onSelect).toHaveBeenCalledWith({ nodes: [], edges: [] });
  });

  it("treats a Cmd double-click as a click and suppresses sigma's zoom", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect });
    const payload = nodeClick("a", { metaKey: true });

    handlers().doubleClickNode(payload);

    expect(payload.preventSigmaDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "a" })],
      edges: [],
    });
  });

  it("suppresses sigma's zoom on a Cmd double-click of empty stage without clearing", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect, selection: { nodes: [quad[0]], edges: [] } });
    const payload = stageClick({ metaKey: true });

    handlers().doubleClickStage(payload);

    expect(payload.preventSigmaDefault).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores a Cmd press-drag-release that sigma reports as a double-click", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect });
    const at = (x: number, y: number) => ({
      node: "a",
      event: { x, y, original: { metaKey: true, ctrlKey: false } },
      preventSigmaDefault: vi.fn(),
    });

    handlers().downNode(at(100, 100));
    const released = at(160, 100);
    handlers().doubleClickNode(released);

    // No toggle, and sigma's zoom stays suppressed so the drag does not also zoom.
    expect(released.preventSigmaDefault).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("still toggles on a Cmd double-click whose pointer barely moved", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect });
    const at = (x: number, y: number) => ({
      node: "a",
      event: { x, y, original: { metaKey: true, ctrlKey: false } },
      preventSigmaDefault: vi.fn(),
    });

    handlers().downNode(at(100, 100));
    handlers().doubleClickNode(at(102, 101));

    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "a" })],
      edges: [],
    });
  });

  it("toggles an edge on a Cmd double-click", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect });
    const payload = {
      edge: "c-d",
      event: { original: { metaKey: true, ctrlKey: false } },
      preventSigmaDefault: vi.fn(),
    };

    handlers().doubleClickEdge(payload);

    expect(payload.preventSigmaDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      nodes: [],
      edges: [expect.objectContaining({ id: "c-d" })],
    });
  });

  it("toggles against the latest selection through handlers registered earlier", () => {
    const onSelect = vi.fn();
    const { rerender } = renderQuad({
      onSelect,
      selection: { nodes: [quad[2]], edges: [] },
    });
    // Sigma keeps the first handlers it was given; they must not close over the first selection.
    const firstHandlers = sigmaStub.registerEvents.mock.calls[0][0] as Record<
      string,
      Handler
    >;

    rerender(
      canvas({
        nodes: quad,
        edges: quadEdges,
        positions: quadPositions,
        onSelect,
        selection: { nodes: [quad[2], quad[0]], edges: [] },
      }),
    );
    firstHandlers.clickNode(nodeClick("a", { ctrlKey: true }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: "c" })],
      edges: [],
    });
  });

  it("leaves a plain double-click to sigma's zoom", () => {
    const onSelect = vi.fn();
    renderQuad({ onSelect });
    const payload = nodeClick("a");

    handlers().doubleClickNode(payload);

    expect(payload.preventSigmaDefault).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("SigmaCanvas Sigma options", () => {
  it("hands the container the same options object on every render, so Sigma is never rebuilt", () => {
    const { rerender } = renderQuad();
    rerender(
      canvas({
        nodes: quad,
        edges: quadEdges,
        positions: quadPositions,
        selection: { nodes: [quad[0]], edges: [] },
      }),
    );

    expect(sigmaStub.optionsSeen.length).toBeGreaterThan(1);
    expect(new Set(sigmaStub.optionsSeen).size).toBe(1);
    expect(sigmaStub.optionsSeen[0]).toBeDefined();
  });

  it("sizes items in screen pixels and turns camera rotation off", () => {
    renderQuad();
    expect(sigmaStub.options?.settings).toMatchObject({
      itemSizesReference: "screen",
      enableCameraRotation: false,
      enableCameraMouseRotation: false,
    });
    expect(sigmaStub.options?.nodeReducer).toBeUndefined();
    expect(sigmaStub.options?.edgeReducer).toBeUndefined();
  });

  it("clips its tooltip to its own box, so a hover near the right edge cannot make a scroll container flip a scrollbar and resize the canvas", () => {
    const { container } = renderQuad();
    expect(container.firstElementChild).toHaveClass("overflow-hidden");
  });
});

describe("SigmaCanvas tooltip", () => {
  let box: HTMLElement;

  function renderBox() {
    box = renderQuad().container;
  }

  function tooltip(): HTMLElement {
    const tip = box.querySelector<HTMLElement>(".pointer-events-none");
    if (!tip) throw new Error("no tooltip rendered");
    return tip;
  }

  function hoverNode(x: number, y: number) {
    act(() => {
      handlers().enterNode({ node: "a", event: { x, y } });
    });
    return tooltip();
  }

  it("sits at the pointer's lower right where it fits", () => {
    renderBox();
    const tip = hoverNode(100, 50);

    expect(tip.style.left).toBe("112px");
    expect(tip.style.top).toBe("62px");
    expect(tip.style.transform).toBe("");
  });

  it("opens to the left of a pointer near the right edge, so the clipped box still shows it", () => {
    renderBox();
    // 395 + 12 would start outside a 400px box and `overflow-hidden` would hide all of it.
    const tip = hoverNode(395, 50);

    expect(tip.style.left).toBe("383px");
    expect(tip.style.top).toBe("62px");
    expect(tip.style.transform).toBe("translate(-100%, 0)");
  });

  it("opens above a pointer near the bottom edge", () => {
    renderBox();
    const tip = hoverNode(100, 295);

    expect(tip.style.left).toBe("112px");
    expect(tip.style.top).toBe("283px");
    expect(tip.style.transform).toBe("translate(0, -100%)");
  });

  it("flips both ways in the bottom right corner, for an edge tooltip too", () => {
    renderBox();
    act(() => {
      handlers().enterEdge({ edge: "a-b", event: { x: 390, y: 290 } });
    });

    expect(tooltip().style.transform).toBe("translate(-100%, -100%)");
  });

  it("is placed against the box's size at the time of the hover", () => {
    renderBox();
    sigmaStub.dimensions = { width: 1200, height: 800 };
    // The same pointer that flipped in a 400px box has room here.
    const tip = hoverNode(395, 50);

    expect(tip.style.left).toBe("407px");
    expect(tip.style.transform).toBe("");
  });
});

describe("SigmaCanvas selection focus", () => {
  beforeEach(() => {
    clearStateWrites();
  });

  it("writes no state while the selection is empty", async () => {
    renderQuad();
    await flushDimBatch();
    expect(writtenKeys()).toEqual([]);
  });

  it("pills a lone selected node, keeps its neighbours and edges lit and dims the rest", async () => {
    renderQuad({ selection: { nodes: [quad[0]], edges: [] } });
    await flushDimBatch();

    expect(nodeState("a")).toMatchObject({
      isSelected: true,
      isPill: true,
      isDimmed: false,
    });
    expect(nodeState("b")).toMatchObject({ isFocus: true, isDimmed: false });
    expect(nodeState("c")).toMatchObject({ isDimmed: true });
    expect(nodeState("c").isFocus).not.toBe(true);
    expect(edgeState("a-b")).toMatchObject({ isFocus: true, isDimmed: false });
    expect(edgeState("c-d")).toMatchObject({ isDimmed: true });
    expect(edgeState("c-d").isFocus).not.toBe(true);
  });

  function selectOnLoadedQuad(selection: GraphCanvasProps["selection"]) {
    const view = renderQuad();
    clearStateWrites();
    view.rerender(
      canvas({ nodes: quad, edges: quadEdges, positions: quadPositions, selection }),
    );
    return view;
  }

  it("paints the selection before the dim, which lands in one batch after the next frame", async () => {
    selectOnLoadedQuad({ nodes: [quad[0]], edges: [] });

    expect(nodeState("a")).toMatchObject({ isSelected: true, isPill: true });
    expect(sigmaStub.setNodesState).not.toHaveBeenCalled();

    await flushDimBatch();
    expect(sigmaStub.setNodesState).toHaveBeenCalledTimes(1);
    expect(sigmaStub.setNodesState).toHaveBeenCalledWith(["c", "d"], {
      isDimmed: true,
    });
  });

  it("writes only the old and new selection's items when the selection changes, never every item", async () => {
    // `e` is in neither selection's focus, so nothing about it changes.
    const withLoner: GNode[] = [...quad, { id: "e", kind: "host" }];
    const lonerPositions = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const { rerender } = renderQuad({
      nodes: withLoner,
      positions: lonerPositions,
      selection: { nodes: [quad[0]], edges: [] },
    });
    await flushDimBatch();
    clearStateWrites();

    rerender(
      canvas({
        nodes: withLoner,
        edges: quadEdges,
        positions: lonerPositions,
        selection: { nodes: [quad[2]], edges: [] },
      }),
    );
    await flushDimBatch();

    expect(writtenKeys().sort()).toEqual(["a", "a-b", "b", "c", "c-d", "d"]);
    expect(sigmaStub.setNodesState).not.toHaveBeenCalled();
    expect(nodeState("a")).toMatchObject({ isSelected: false, isDimmed: true });
    expect(nodeState("c")).toMatchObject({ isSelected: true, isPill: true });
  });

  it("gives no pill to a multi-selection", () => {
    renderQuad({ selection: { nodes: [quad[0], quad[2]], edges: [] } });
    expect(nodeState("a")).toMatchObject({ isSelected: true, isPill: false });
  });

  it("flags a selected edge", () => {
    renderQuad({ selection: { nodes: [], edges: [quadEdges[1]] } });
    expect(edgeState("c-d")).toMatchObject({ isSelected: true });
  });

  it("leaves the refresh to Sigma, which re-evaluates only the items whose state changed", async () => {
    const { rerender } = renderQuad();
    sigmaStub.refresh.mockClear();
    sigmaStub.scheduleRefresh.mockClear();

    rerender(
      canvas({
        nodes: quad,
        edges: quadEdges,
        positions: quadPositions,
        selection: { nodes: [quad[0]], edges: [] },
      }),
    );
    await flushDimBatch();

    expect(sigmaStub.setNodeState).toHaveBeenCalled();
    expect(sigmaStub.setNodesState).toHaveBeenCalled();
    expect(sigmaStub.refresh).not.toHaveBeenCalled();
    expect(sigmaStub.scheduleRefresh).not.toHaveBeenCalled();
  });

  it("sets state only on nodes the graph holds, because Sigma throws on an unknown key", async () => {
    // A selection restored from the URL can name a protein before (or without) its graph loading.
    render(
      canvas({
        positions: null,
        selection: { nodes: [{ id: "zz", kind: "host" }], edges: [] },
      }),
    );
    await flushDimBatch();

    expect(sigmaStub.setNodeState).not.toHaveBeenCalled();
    expect(sigmaStub.setEdgeState).not.toHaveBeenCalled();
    expect(writtenKeys()).not.toContain("zz");
  });

  it("drops a dim batch still waiting for its frame when the canvas unmounts", async () => {
    const { unmount } = selectOnLoadedQuad({ nodes: [quad[0]], edges: [] });
    unmount();
    await flushDimBatch();
    expect(sigmaStub.setNodesState).not.toHaveBeenCalled();
  });

  it("leaves the highlights alone on a layout switch, which moves nodes that keep their state", async () => {
    const selection = { nodes: [quad[0]], edges: [] };
    const { rerender } = renderQuad({ selection });
    await flushDimBatch();
    clearStateWrites();

    rerender(
      canvas({
        nodes: quad,
        edges: quadEdges,
        positions: new Float64Array([8, 7, 6, 5, 4, 3, 2, 1]),
        selection,
      }),
    );
    await flushDimBatch();

    // Sigma clears item state only when the graph is cleared, not on the refresh a move asks for,
    // so nothing is re-dimmed or reset. Compiled, nothing re-syncs; uncompiled, GraphEvents
    // re-syncs with equal Sets, which may rewrite members with the values they already hold.
    expect(sigmaStub.refresh).toHaveBeenCalled();
    expect(sigmaStub.setNodesState).not.toHaveBeenCalled();
    expect(sigmaStub.setEdgesState).not.toHaveBeenCalled();
    expect(
      writtenKeys().every((key) => ["a", "b", "a-b"].includes(key)),
    ).toBe(true);
    for (const id of ["a", "b"]) {
      if (writtenKeys().includes(id)) {
        expect(nodeState(id)).toEqual(
          expect.objectContaining({ isDimmed: false }),
        );
      }
    }
    if (writtenKeys().includes("a")) {
      expect(nodeState("a")).toMatchObject({ isSelected: true, isPill: true });
    }
  });

  it("writes a dim still waiting for its frame before exporting the PNG, which copies the state as it is", async () => {
    const { downloadAsImage } = await import("@sigma/export-image");
    vi.mocked(downloadAsImage).mockClear();
    const handleRef: GraphCanvasProps["handleRef"] = { current: null };
    const view = render(canvas({ nodes: quad, edges: quadEdges, positions: quadPositions, handleRef }));
    clearStateWrites();
    view.rerender(
      canvas({
        nodes: quad,
        edges: quadEdges,
        positions: quadPositions,
        handleRef,
        selection: { nodes: [quad[0]], edges: [] },
      }),
    );
    expect(sigmaStub.setNodesState).not.toHaveBeenCalled();

    handleRef.current?.exportPng();

    expect(downloadAsImage).toHaveBeenCalledTimes(1);
    expect(sigmaStub.setNodesState).toHaveBeenCalledWith(["c", "d"], {
      isDimmed: true,
    });
    const dimmedAt = sigmaStub.setNodesState.mock.invocationCallOrder[0];
    const exportedAt = vi.mocked(downloadAsImage).mock.invocationCallOrder[0];
    expect(dimmedAt).toBeLessThan(exportedAt);
  });

  it("re-applies the highlights to a reloaded graph, whose state Sigma cleared", async () => {
    const selection = { nodes: [quad[0]], edges: [] };
    const { rerender } = renderQuad({ selection });
    await flushDimBatch();
    clearStateWrites();
    cameraStub.setState.mockClear();

    // New rows holding the same protein: GraphLoader clears and re-imports the graph.
    const reloaded: GNode[] = [quad[0], { id: "e", kind: "host" }];
    rerender(
      canvas({
        nodes: reloaded,
        edges: [],
        positions: new Float64Array([1, 2, 3, 4]),
        selection,
      }),
    );

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(2);
    // At once, with no frame in between: a load is not a click waiting for its answer.
    expect(nodeState("a")).toMatchObject({ isSelected: true, isPill: true });
    expect(nodeState("e")).toMatchObject({ isDimmed: true });

    // GraphLoader must sync on its own, between the load and the re-fit it does right after:
    // with the React Compiler, an unchanged selection keeps its memoized Sets, so GraphEvents'
    // sync effect does not re-run on a reload (Vitest, uncompiled, re-runs it on every render).
    const loadedAt = sigmaStub.loadGraph.mock.invocationCallOrder.at(-1) ?? 0;
    const refitAt = cameraStub.setState.mock.invocationCallOrder.at(0) ?? 0;
    const between = (calls: unknown[][], order: number[], id: string) =>
      calls
        .map((call, i) => ({ call, at: order[i] }))
        .filter(
          ({ call, at }) =>
            (call[0] === id ||
              (Array.isArray(call[0]) && call[0].includes(id))) &&
            at > loadedAt &&
            at < refitAt,
        );
    expect(refitAt).toBeGreaterThan(loadedAt);
    expect(
      between(
        sigmaStub.setNodeState.mock.calls,
        sigmaStub.setNodeState.mock.invocationCallOrder,
        "a",
      ),
    ).toHaveLength(1);
    expect(
      between(
        sigmaStub.setNodesState.mock.calls,
        sigmaStub.setNodesState.mock.invocationCallOrder,
        "e",
      ),
    ).toHaveLength(1);
  });
});

describe("SigmaCanvas label color", () => {
  const hexColor = /^#[0-9a-f]{6}$/;

  // A 2D context whose pixel reads back the given bytes, standing in for the browser resolving an
  // `oklch()` token (jsdom's canvas has no 2D context at all).
  function fakeContext(pixel: () => number[]) {
    return {
      fillStyle: "",
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(pixel()) }),
    } as unknown as CanvasRenderingContext2D;
  }

  afterEach(() => {
    document.documentElement.style.removeProperty("--foreground");
    document.documentElement.removeAttribute("data-theme");
  });

  function labelColors(): unknown[] {
    return loadedGraph()
      .nodes()
      .map((id): unknown => loadedGraph().getNodeAttribute(id, "labelColor"));
  }

  it("resolves the theme's --foreground to a hex label color, and re-resolves on a theme change", async () => {
    let pixel = [229, 229, 229, 255];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => fakeContext(() => pixel)) as never,
    );
    document.documentElement.style.setProperty(
      "--foreground",
      "oklch(0.922 0 0)",
    );

    renderQuad();
    expect(labelColors()).toEqual(["#e5e5e5", "#e5e5e5", "#e5e5e5", "#e5e5e5"]);
    const updateHints: unknown[] = [];
    loadedGraph().on("eachNodeAttributesUpdated", (payload: { hints: unknown }) => {
      updateHints.push(payload.hints);
    });

    pixel = [10, 10, 10, 255];
    act(() => {
      document.documentElement.setAttribute("data-theme", "dxkb-light");
    });

    await waitFor(() => {
      expect(labelColors()).toEqual([
        "#0a0a0a",
        "#0a0a0a",
        "#0a0a0a",
        "#0a0a0a",
      ]);
    });
    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    // No `attributes` hint: with one, Sigma redraws every node with indexation skipped and throws
    // ("can't be repaint") for nodes it has not drawn yet, as right after a load.
    expect(updateHints).toEqual([null]);
  });

  it("falls back to a hex, never the raw oklch() token, when there is no 2D context", () => {
    document.documentElement.style.setProperty(
      "--foreground",
      "oklch(0.922 0 0)",
    );

    renderQuad();

    for (const color of labelColors()) {
      expect(color).toMatch(hexColor);
    }
  });
});

describe("SigmaCanvas camera from the URL", () => {
  const restored = { ratio: 0.25, x: 0.3, y: 0.7 };

  afterEach(() => {
    vi.useRealTimers();
    history.replaceState(null, "", "/");
  });

  it("applies the URL camera once the first positions load, and the load does not re-fit over it", () => {
    const { rerender } = render(canvas({ camera: restored, positions: null }));
    expect(cameraStub.setState).not.toHaveBeenCalled();

    rerender(
      canvas({ camera: restored, positions: new Float64Array([1, 2, 3, 4]) }),
    );

    expect(cameraStub.getBoundedRatio).toHaveBeenCalledWith(0.25);
    expect(cameraStub.state).toMatchObject(restored);
    expect(sigmaStub.reset).not.toHaveBeenCalled();
  });

  it("clamps the restored ratio to Sigma's bounds", () => {
    cameraStub.getBoundedRatio.mockReturnValue(0.5);
    render(
      canvas({ camera: restored, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    expect(cameraStub.state).toMatchObject({ ratio: 0.5, x: 0.3, y: 0.7 });
  });

  it("applies the camera only on that first load", () => {
    const positions = new Float64Array([1, 2, 3, 4]);
    const { rerender } = render(canvas({ camera: restored, positions }));
    cameraStub.setState({ ratio: 0.1 });
    cameraStub.setState.mockClear();

    rerender(canvas({ camera: { ratio: 2, x: 0, y: 0 }, positions }));

    expect(cameraStub.setState).not.toHaveBeenCalled();
    expect(cameraStub.state.ratio).toBe(0.1);
  });

  it("re-fits the camera when new rows load after the first graph", () => {
    const { rerender } = render(
      canvas({ camera: restored, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    rerender(
      canvas({
        camera: restored,
        nodes: [{ id: "c", kind: "microbial" }],
        edges: [],
        positions: new Float64Array([5, 6]),
      }),
    );

    expect(cameraStub.state).toMatchObject({ ratio: 1, x: 0.5, y: 0.5 });
  });

  it("reports camera moves once, debounced and rounded, never per frame", () => {
    vi.useFakeTimers();
    const onCameraChange = vi.fn();
    render(
      canvas({ onCameraChange, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    act(() => {
      vi.runAllTimers();
    });
    onCameraChange.mockClear();

    for (const ratio of [0.9, 0.7, 0.5, 0.3123456]) {
      act(() => {
        cameraStub.setState({ ratio, x: 0.412345678, y: 0.6 });
        vi.advanceTimersByTime(100);
      });
    }
    expect(onCameraChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCameraChange).toHaveBeenCalledTimes(1);
    expect(onCameraChange).toHaveBeenCalledWith({
      ratio: 0.312346,
      x: 0.4123,
      y: 0.6,
    });
  });

  it("reports the default framing as no camera", () => {
    vi.useFakeTimers();
    const onCameraChange = vi.fn();
    render(
      canvas({
        camera: restored,
        onCameraChange,
        positions: new Float64Array([1, 2, 3, 4]),
      }),
    );
    act(() => {
      cameraStub.setState({ ratio: 1, x: 0.5, y: 0.5 });
      vi.advanceTimersByTime(250);
    });
    expect(onCameraChange).toHaveBeenLastCalledWith(null);
  });

  it("writes nothing once unmounted, so a move just before leaving cannot land on the next page", () => {
    vi.useFakeTimers();
    const onCameraChange = vi.fn();
    const { unmount } = render(
      canvas({ onCameraChange, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    act(() => {
      vi.runAllTimers();
    });
    onCameraChange.mockClear();

    act(() => {
      cameraStub.setState({ ratio: 0.4 });
    });
    unmount();
    vi.advanceTimersByTime(1_000);

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it("skips a report that falls due after the URL has moved to another page", () => {
    vi.useFakeTimers();
    history.replaceState(null, "", "/taxonomy/584?tab=interactions");
    const onCameraChange = vi.fn();
    render(
      canvas({ onCameraChange, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    act(() => {
      vi.runAllTimers();
    });
    onCameraChange.mockClear();

    act(() => {
      cameraStub.setState({ ratio: 0.4 });
    });
    // Next pushes the destination during commit, before the old page's effect cleanup clears the
    // timer, so the debounce can fire against the new URL.
    history.pushState(null, "", "/feature/x");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it("skips a report that falls due after the tab changed on the same page", () => {
    vi.useFakeTimers();
    history.replaceState(null, "", "/taxonomy/584?tab=interactions");
    const onCameraChange = vi.fn();
    render(
      canvas({ onCameraChange, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    act(() => {
      vi.runAllTimers();
    });
    onCameraChange.mockClear();

    act(() => {
      cameraStub.setState({ ratio: 0.4 });
    });
    history.pushState(null, "", "/taxonomy/584?tab=overview");
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it("still reports when only the Interactions params of the same page changed", () => {
    vi.useFakeTimers();
    history.replaceState(null, "", "/taxonomy/584?tab=interactions");
    const onCameraChange = vi.fn();
    render(
      canvas({ onCameraChange, positions: new Float64Array([1, 2, 3, 4]) }),
    );
    act(() => {
      vi.runAllTimers();
    });
    onCameraChange.mockClear();

    act(() => {
      cameraStub.setState({ ratio: 0.4 });
    });
    history.replaceState(
      null,
      "",
      "/taxonomy/584?tab=interactions&interactionsGraph.node=a",
    );
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onCameraChange).toHaveBeenCalledTimes(1);
  });
});

import { act, render } from "@testing-library/react";
import Graph from "graphology";
import { useState, type ReactNode } from "react";

import { SigmaCanvas } from "../sigma/sigma-canvas";
import type { GEdge, GNode, GraphCanvasProps } from "@/lib/interactions/types";
import {
  renderEdge,
  renderEdgeDim,
  renderEdgeFocus,
  renderNodeDim,
} from "@/lib/interactions/graph-theme";
import { buildIncidenceIndex } from "@/lib/interactions/selection-focus";

// Sigma needs WebGL; its React bindings are stubbed over a real graphology graph so GraphLoader's
// load-vs-move choice is observable.
const sigmaStub = vi.hoisted(() => ({
  graph: null as Graph | null,
  refresh: vi.fn(),
  animatedReset: vi.fn(() => Promise.resolve()),
  loadGraph: vi.fn(),
  registerEvents: vi.fn(),
  setSettings: vi.fn(),
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
    getCamera: () =>
      Object.assign(cameraStub, { animatedReset: sigmaStub.animatedReset }),
  };
  return {
    // The real container builds its graph from the `graph` prop (a constructor), else a plain
    // non-multi `new Graph()`; mirroring that keeps a missing `graph` prop from passing silently.
    SigmaContainer: ({
      children,
      graph,
    }: {
      children: ReactNode;
      graph?: new () => Graph;
    }) => {
      useState(() => {
        sigmaStub.graph = graph ? new graph() : new Graph();
      });
      return <>{children}</>;
    },
    useSigma: () => sigma,
    useLoadGraph: () => sigmaStub.loadGraph,
    useRegisterEvents: () => sigmaStub.registerEvents,
    useSetSettings: () => sigmaStub.setSettings,
  };
});
vi.mock("../sigma/zoom-control", () => ({ ZoomControl: () => null }));
vi.mock("@sigma/export-image", () => ({ downloadAsImage: vi.fn() }));
vi.mock("sigma/rendering", () => ({
  drawDiscNodeHover: vi.fn(),
  EdgeRectangleProgram: vi.fn(),
}));

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
  cameraStub.state = { x: 0.5, y: 0.5, ratio: 1, angle: 0 };
  cameraStub.listeners.clear();
  cameraStub.getBoundedRatio.mockImplementation((ratio: number) => ratio);
  sigmaStub.graph = null;
  sigmaStub.loadGraph.mockImplementation((graph: Graph) => {
    loadedGraph().clear();
    loadedGraph().import(graph);
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
    expect(sigmaStub.animatedReset).toHaveBeenCalledTimes(1);
  });

  it("does nothing when a re-render brings the same positions", () => {
    const positions = new Float64Array([1, 2, 3, 4]);
    const { rerender } = render(canvas({ positions }));

    rerender(canvas({ positions, selection: { nodes: [nodes[0]], edges: [] } }));

    expect(sigmaStub.loadGraph).toHaveBeenCalledTimes(1);
    expect(sigmaStub.refresh).not.toHaveBeenCalled();
    expect(sigmaStub.animatedReset).not.toHaveBeenCalled();
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
    expect(sigmaStub.animatedReset).not.toHaveBeenCalled();
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

interface Reducers {
  nodeReducer: (id: string, data: object) => object;
  edgeReducer: (id: string, data: object) => object;
}

function latestReducers(): Reducers {
  const withReducers = sigmaStub.setSettings.mock.calls
    .map(([settings]) => settings as Partial<Reducers>)
    .filter((settings) => settings.nodeReducer !== undefined);
  const last = withReducers.at(-1);
  if (!last) throw new Error("no reducers were installed");
  return last as Reducers;
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

describe("SigmaCanvas selection focus", () => {
  it("dims nothing while the selection is empty", () => {
    renderQuad();
    const data = { color: "x" };
    expect(latestReducers().nodeReducer("c", data)).toBe(data);
  });

  it("keeps a selected node's neighbours and edges lit and dims the rest", () => {
    renderQuad({ selection: { nodes: [quad[0]], edges: [] } });
    const { nodeReducer, edgeReducer } = latestReducers();

    expect(nodeReducer("b", { color: "x" })).toEqual({ color: "x", zIndex: 1 });
    expect(nodeReducer("c", { color: "x" })).toEqual({
      color: renderNodeDim,
      label: null,
      zIndex: 0,
    });
    expect(
      edgeReducer("a-b", { color: renderEdge, size: 1, experimental: false }),
    ).toEqual({
      color: renderEdgeFocus,
      size: 1.5,
      zIndex: 1,
      experimental: false,
    });
    expect(edgeReducer("c-d", { color: renderEdge, size: 1 })).toEqual({
      color: renderEdgeDim,
      size: 1,
      zIndex: 0,
    });
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
    expect(sigmaStub.animatedReset).not.toHaveBeenCalled();
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

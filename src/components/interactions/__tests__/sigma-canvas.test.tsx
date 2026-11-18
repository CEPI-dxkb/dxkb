import { act, render } from "@testing-library/react";
import Graph from "graphology";
import type { ReactNode } from "react";

import { SigmaCanvas } from "../sigma/sigma-canvas";
import type { GEdge, GNode, GraphCanvasProps } from "@/lib/interactions/types";

// Sigma needs WebGL; its React bindings are stubbed over a real graphology graph so GraphLoader's
// load-vs-move choice is observable.
const sigmaStub = vi.hoisted(() => ({
  graph: null as Graph | null,
  refresh: vi.fn(),
  animatedReset: vi.fn(() => Promise.resolve()),
  loadGraph: vi.fn(),
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
    SigmaContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
    useSigma: () => sigma,
    useLoadGraph: () => sigmaStub.loadGraph,
    useRegisterEvents: () => vi.fn(),
    useSetSettings: () => vi.fn(),
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
  return (
    <SigmaCanvas
      nodes={nodes}
      edges={edges}
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
  sigmaStub.graph = new Graph({ multi: true });
  sigmaStub.loadGraph.mockImplementation((graph: Graph) => {
    loadedGraph().clear();
    loadedGraph().import(graph);
  });
});

describe("SigmaCanvas graph loading", () => {
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

import { render } from "@testing-library/react";
import Graph from "graphology";
import type { ReactNode } from "react";

import { SigmaCanvas } from "../sigma/sigma-canvas";
import type { GEdge, GNode, GraphCanvasProps } from "@/lib/interactions/types";

// Sigma needs WebGL, which jsdom lacks. Its React bindings are replaced by a
// stub sigma over a real graphology graph, so GraphLoader's choice between
// loading a new graph and moving the loaded one is observable.
const sigmaStub = vi.hoisted(() => ({
  graph: null as Graph | null,
  refresh: vi.fn(),
  animatedReset: vi.fn(() => Promise.resolve()),
  loadGraph: vi.fn(),
}));

vi.mock("@react-sigma/core", () => {
  const sigma = {
    getGraph: () => sigmaStub.graph,
    refresh: sigmaStub.refresh,
    getCamera: () => ({ animatedReset: sigmaStub.animatedReset }),
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
// Reads WebGL constants at import time.
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
  sigmaStub.graph = new Graph({ multi: true });
  // What react-sigma's loadGraph does: replace the sigma graph's contents.
  sigmaStub.loadGraph.mockImplementation((graph: Graph) => {
    loadedGraph().clear();
    loadedGraph().import(graph);
  });
});

describe("SigmaCanvas graph loading", () => {
  it("loads nothing until positions for these exact nodes arrive", () => {
    const { rerender } = render(canvas({ positions: null }));
    expect(sigmaStub.loadGraph).not.toHaveBeenCalled();

    // Positions for another node count (rows that have since changed).
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

    // New rows: their layout is pending (and may yet fail), so the old graph
    // must not stay drawn and clickable.
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

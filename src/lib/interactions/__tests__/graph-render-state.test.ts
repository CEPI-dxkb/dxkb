import Graph from "graphology";
import { describe, expect, it } from "vitest";

import type { GraphSigma } from "../graph-render-config";
import {
  cancelRenderSync,
  edgeStateFor,
  flushRenderSync,
  nodeStateFor,
  syncRenderState,
  type RenderInputs,
} from "../graph-render-state";

const noInputs = {
  selectedNodeIds: new Set<string>(),
  selectedEdgeIds: new Set<string>(),
  focus: null,
};

describe("nodeStateFor", () => {
  it("is all-false with no selection", () => {
    expect(nodeStateFor("a", noInputs)).toEqual({
      isSelected: false,
      isPill: false,
      isFocus: false,
      isDimmed: false,
    });
  });

  it("pills a lone selected node but not a multi-selection", () => {
    const one = { ...noInputs, selectedNodeIds: new Set(["a"]) };
    const two = { ...noInputs, selectedNodeIds: new Set(["a", "b"]) };
    expect(nodeStateFor("a", one)).toMatchObject({
      isSelected: true,
      isPill: true,
    });
    expect(nodeStateFor("a", two)).toMatchObject({
      isSelected: true,
      isPill: false,
    });
  });

  it("dims nodes outside the focus and keeps focus nodes undimmed", () => {
    const inputs = {
      ...noInputs,
      selectedNodeIds: new Set(["a"]),
      focus: { nodes: new Set(["a", "b"]), edges: new Set<string>() },
    };
    expect(nodeStateFor("b", inputs)).toMatchObject({
      isFocus: true,
      isDimmed: false,
    });
    expect(nodeStateFor("z", inputs)).toMatchObject({
      isFocus: false,
      isDimmed: true,
    });
    expect(nodeStateFor("a", inputs)).toMatchObject({
      isSelected: true,
      isDimmed: false,
    });
  });
});

describe("edgeStateFor", () => {
  it("marks focus edges and dims the rest while a focus exists", () => {
    const inputs = {
      ...noInputs,
      focus: { nodes: new Set<string>(), edges: new Set(["e1"]) },
    };
    expect(edgeStateFor("e1", inputs)).toMatchObject({
      isFocus: true,
      isDimmed: false,
    });
    expect(edgeStateFor("e2", inputs)).toMatchObject({
      isFocus: false,
      isDimmed: true,
    });
  });

  it("is all-false with no focus, and flags selected edges", () => {
    expect(edgeStateFor("e1", noInputs)).toEqual({
      isSelected: false,
      isFocus: false,
      isDimmed: false,
    });
    expect(
      edgeStateFor("e1", { ...noInputs, selectedEdgeIds: new Set(["e1"]) })
        .isSelected,
    ).toBe(true);
  });
});

/**
 * A Sigma stand-in over a real graph that merges partial states as Sigma does and records each
 * write, so a test sees both the resulting state and how much was written.
 */
function fakeSigma(graph: Graph) {
  const states = new Map<string, Record<string, boolean>>();
  const writes: { kind: "node" | "edge" | "nodes" | "edges"; keys: string[] }[] = [];
  const merge = (key: string, state: Record<string, boolean>) => {
    states.set(key, { ...states.get(key), ...state });
  };
  const sigma = {
    getGraph: () => graph,
    setNodeState: vi.fn((key: string, state: Record<string, boolean>) => {
      if (!graph.hasNode(key)) throw new Error(`unknown node ${key}`);
      writes.push({ kind: "node", keys: [key] });
      merge(`n:${key}`, state);
    }),
    setEdgeState: vi.fn((key: string, state: Record<string, boolean>) => {
      if (!graph.hasEdge(key)) throw new Error(`unknown edge ${key}`);
      writes.push({ kind: "edge", keys: [key] });
      merge(`e:${key}`, state);
    }),
    setNodesState: vi.fn((keys: string[], state: Record<string, boolean>) => {
      writes.push({ kind: "nodes", keys: [...keys] });
      for (const key of keys) merge(`n:${key}`, state);
    }),
    setEdgesState: vi.fn((keys: string[], state: Record<string, boolean>) => {
      writes.push({ kind: "edges", keys: [...keys] });
      for (const key of keys) merge(`e:${key}`, state);
    }),
    refresh: vi.fn(),
    scheduleRefresh: vi.fn(),
  };
  const defaults = { isSelected: false, isPill: false, isFocus: false, isDimmed: false };
  return {
    sigma: sigma as unknown as GraphSigma,
    stub: sigma,
    writes,
    node: (id: string) => ({ ...defaults, ...states.get(`n:${id}`) }),
    edge: (id: string) => {
      const { isPill: _isPill, ...edgeDefaults } = defaults;
      return { ...edgeDefaults, ...states.get(`e:${id}`) };
    },
    /** Items written one at a time (a batch counts once). */
    singleWrites: () => writes.filter((w) => w.kind === "node" || w.kind === "edge").length,
    /** Drops the item state and the write history that Sigma loses when its graph is reloaded. */
    forgetItemState: () => {
      states.clear();
      writes.length = 0;
      for (const write of [sigma.setNodeState, sigma.setEdgeState, sigma.setNodesState, sigma.setEdgesState]) {
        write.mockClear();
      }
    },
  };
}

/** A hub `h` joined to `a` and `b`, a pair `c`-`d`, and `extra` isolated nodes `x0`, `x1`, … */
function testGraph(extra = 0): Graph {
  const graph = new Graph({ multi: true });
  for (const id of ["h", "a", "b", "c", "d"]) graph.addNode(id);
  for (let i = 0; i < extra; i++) graph.addNode(`x${String(i)}`);
  graph.addEdgeWithKey("h-a", "h", "a");
  graph.addEdgeWithKey("h-b", "h", "b");
  graph.addEdgeWithKey("c-d", "c", "d");
  return graph;
}

function selectNode(graph: Graph, ...ids: string[]): RenderInputs {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const id of ids) {
    graph.forEachEdge(id, (edge, _attrs, source, target) => {
      edges.add(edge);
      nodes.add(source);
      nodes.add(target);
    });
  }
  return {
    selectedNodeIds: new Set(ids),
    selectedEdgeIds: new Set(),
    focus: { nodes, edges },
  };
}

/** Lets the frame the sync asked for pass, then the task queued after it. */
function nextFrameAndTask() {
  vi.advanceTimersToNextFrame();
  vi.advanceTimersByTime(1);
}

describe("syncRenderState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing while nothing is selected", () => {
    const fake = fakeSigma(testGraph());
    syncRenderState(fake.sigma, noInputs);
    nextFrameAndTask();
    expect(fake.writes).toEqual([]);
  });

  it("paints a first selection and its focus at once, and dims the rest in one batch after the next frame", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);

    syncRenderState(fake.sigma, selectNode(graph, "h"));

    expect(fake.node("h")).toEqual({ isSelected: true, isPill: true, isFocus: true, isDimmed: false });
    expect(fake.node("a")).toMatchObject({ isFocus: true, isDimmed: false });
    expect(fake.edge("h-a")).toMatchObject({ isFocus: true, isDimmed: false });
    // Not yet: the frame answering the click shows the selection first.
    expect(fake.node("c").isDimmed).toBe(false);
    expect(fake.stub.setNodesState).not.toHaveBeenCalled();

    nextFrameAndTask();

    expect(fake.stub.setNodesState).toHaveBeenCalledTimes(1);
    expect(fake.stub.setNodesState).toHaveBeenCalledWith(["c", "d"], { isDimmed: true });
    expect(fake.stub.setEdgesState).toHaveBeenCalledWith(["c-d"], { isDimmed: true });
    expect(fake.node("c")).toEqual({ isSelected: false, isPill: false, isFocus: false, isDimmed: true });
    expect(fake.edge("c-d")).toMatchObject({ isFocus: false, isDimmed: true });
    expect(fake.node("h").isDimmed).toBe(false);
  });

  it("never writes every item one by one, so a first selection's cost is its focus, not the graph", () => {
    const graph = testGraph(200);
    const fake = fakeSigma(graph);

    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();

    // h, a, b and the two edges: everything else is one batch per kind.
    expect(fake.singleWrites()).toBe(5);
    expect(fake.node("x7").isDimmed).toBe(true);
  });

  it("writes only the items whose membership changed when one selection replaces another", () => {
    const graph = testGraph(50);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    fake.writes.length = 0;

    syncRenderState(fake.sigma, selectNode(graph, "c"));
    nextFrameAndTask();

    const written = fake.writes.flatMap((w) => w.keys).sort();
    expect(written).toEqual(["a", "b", "c", "c-d", "d", "h", "h-a", "h-b"]);
    expect(fake.stub.setNodesState).toHaveBeenCalledTimes(1);
    expect(fake.node("h")).toEqual({ isSelected: false, isPill: false, isFocus: false, isDimmed: true });
    expect(fake.edge("h-a")).toMatchObject({ isFocus: false, isDimmed: true });
    expect(fake.node("c")).toMatchObject({ isSelected: true, isPill: true, isDimmed: false });
    expect(fake.node("x3").isDimmed).toBe(true);
  });

  it("clears the previous members at once and un-dims the rest in one batch after the next frame", () => {
    const graph = testGraph(20);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    fake.writes.length = 0;

    syncRenderState(fake.sigma, noInputs);

    expect(fake.node("h")).toEqual({ isSelected: false, isPill: false, isFocus: false, isDimmed: false });
    expect(fake.singleWrites()).toBe(5);
    nextFrameAndTask();
    expect(fake.writes.filter((w) => w.kind === "nodes")).toHaveLength(1);
    expect(fake.node("c").isDimmed).toBe(false);
    expect(fake.node("x0").isDimmed).toBe(false);
    expect(fake.edge("c-d").isDimmed).toBe(false);
  });

  it("replaces a dim batch still waiting when the selection changes again", () => {
    const graph = testGraph(5);
    const fake = fakeSigma(graph);

    syncRenderState(fake.sigma, selectNode(graph, "h"));
    syncRenderState(fake.sigma, noInputs);
    nextFrameAndTask();

    for (const id of ["h", "a", "b", "c", "d", "x0", "x4"]) {
      expect(fake.node(id)).toEqual({ isSelected: false, isPill: false, isFocus: false, isDimmed: false });
    }

    syncRenderState(fake.sigma, selectNode(graph, "h"));
    syncRenderState(fake.sigma, selectNode(graph, "c"));
    nextFrameAndTask();

    expect(fake.node("h").isDimmed).toBe(true);
    expect(fake.node("a").isDimmed).toBe(true);
    expect(fake.node("x0").isDimmed).toBe(true);
    expect(fake.node("c")).toMatchObject({ isSelected: true, isDimmed: false });
    expect(fake.node("d")).toMatchObject({ isFocus: true, isDimmed: false });
  });

  it("writes everything at once after a reload, whose items Sigma holds no state for", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    // Sigma drops every item's state when its graph is reloaded, so none of the first sync's
    // state or calls may stand in for what the reload writes.
    fake.forgetItemState();

    // The same selection over the reloaded graph.
    syncRenderState(fake.sigma, selectNode(graph, "h"), { reloaded: true });

    expect(fake.node("h")).toMatchObject({ isSelected: true, isPill: true });
    expect(fake.stub.setNodesState).toHaveBeenLastCalledWith(["c", "d"], { isDimmed: true });
    expect(fake.stub.setEdgesState).toHaveBeenLastCalledWith(["c-d"], { isDimmed: true });
  });

  it("writes nothing for a selected key the graph lacks, because Sigma throws on one", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);
    const inputs: RenderInputs = {
      selectedNodeIds: new Set(["zz"]),
      selectedEdgeIds: new Set(["zz-edge"]),
      focus: { nodes: new Set(["zz"]), edges: new Set() },
    };

    syncRenderState(fake.sigma, inputs);
    nextFrameAndTask();

    expect(fake.writes.flatMap((w) => w.keys)).not.toContain("zz");
    expect(fake.writes.flatMap((w) => w.keys)).not.toContain("zz-edge");
    expect(fake.node("h").isDimmed).toBe(true);
  });

  it("never asks Sigma for a refresh", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    syncRenderState(fake.sigma, noInputs);
    nextFrameAndTask();
    expect(fake.stub.refresh).not.toHaveBeenCalled();
    expect(fake.stub.scheduleRefresh).not.toHaveBeenCalled();
  });

  it("flushes a first selection's waiting dim at once, leaving nothing for the frame", () => {
    const graph = testGraph(3);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));

    flushRenderSync(fake.sigma);

    expect(fake.node("c").isDimmed).toBe(true);
    expect(fake.node("x2").isDimmed).toBe(true);
    expect(fake.edge("c-d").isDimmed).toBe(true);
    expect(fake.node("h")).toMatchObject({ isSelected: true, isDimmed: false });
    const written = fake.writes.length;
    nextFrameAndTask();
    expect(fake.writes).toHaveLength(written);
  });

  it("flushes a clear's waiting un-dim at once, leaving nothing for the frame", () => {
    const graph = testGraph(3);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    syncRenderState(fake.sigma, noInputs);

    flushRenderSync(fake.sigma);

    for (const id of ["h", "a", "c", "x0"]) {
      expect(fake.node(id)).toEqual({ isSelected: false, isPill: false, isFocus: false, isDimmed: false });
    }
    expect(fake.edge("c-d").isDimmed).toBe(false);
    const written = fake.writes.length;
    nextFrameAndTask();
    expect(fake.writes).toHaveLength(written);
  });

  it("flushes nothing when no dim batch is waiting", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);
    flushRenderSync(fake.sigma);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    const written = fake.writes.length;

    flushRenderSync(fake.sigma);

    expect(fake.writes).toHaveLength(written);
  });

  it("keeps a waiting dim batch on its frame when an equal sync arrives", () => {
    // Under the React Compiler, the transition that commits a selection can rebuild equal Sets and
    // re-sync while the batch waits; that must not push the dim back a frame.
    const graph = testGraph(3);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));
    vi.advanceTimersToNextFrame();

    syncRenderState(fake.sigma, selectNode(graph, "h"));
    vi.advanceTimersByTime(1);

    expect(fake.stub.setNodesState).toHaveBeenCalledTimes(1);
    expect(fake.node("c").isDimmed).toBe(true);
    nextFrameAndTask();
    expect(fake.stub.setNodesState).toHaveBeenCalledTimes(1);
  });

  it("drops a waiting dim batch on a reload, and dims the reloaded graph at once without its old keys", () => {
    const graph = testGraph(3);
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));

    // New rows: the graph is cleared and re-imported without c, d and the x nodes.
    graph.clear();
    for (const id of ["h", "a", "b", "n1", "n2"]) graph.addNode(id);
    graph.addEdgeWithKey("h-a", "h", "a");
    graph.addEdgeWithKey("h-b", "h", "b");
    graph.addEdgeWithKey("n1-n2", "n1", "n2");
    fake.writes.length = 0;
    fake.stub.setNodesState.mockClear();

    syncRenderState(fake.sigma, selectNode(graph, "h"), { reloaded: true });
    nextFrameAndTask();

    expect(fake.stub.setNodesState).toHaveBeenCalledTimes(1);
    expect(fake.stub.setNodesState).toHaveBeenCalledWith(["n1", "n2"], { isDimmed: true });
    const written = fake.writes.flatMap((w) => w.keys);
    for (const gone of ["c", "d", "c-d", "x0", "x1", "x2"]) {
      expect(written).not.toContain(gone);
    }
    expect(fake.node("h")).toMatchObject({ isSelected: true, isPill: true });
  });

  it("drops a waiting dim batch when the canvas goes away, and a later sync still dims", () => {
    const graph = testGraph();
    const fake = fakeSigma(graph);
    syncRenderState(fake.sigma, selectNode(graph, "h"));

    cancelRenderSync(fake.sigma);
    nextFrameAndTask();
    expect(fake.stub.setNodesState).not.toHaveBeenCalled();

    syncRenderState(fake.sigma, selectNode(graph, "h"));
    nextFrameAndTask();
    expect(fake.node("c").isDimmed).toBe(true);
  });
});

import {
  buildGraphSelectionIndex,
  focusSelectionRef,
  resolveGraphSelection,
  selectHubs,
  selectSubgraphs,
  singleSelectionRef,
} from "../graph-selections";
import type { GEdge, GNode } from "../types";

const nodes = ["a", "b", "c", "d", "e", "f", "x", "y"].map((id): GNode => ({
  id,
  kind: "microbial",
}));
const pairs = [
  ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"], ["a", "f"], ["b", "c"], ["x", "y"],
] as const;
const edges = pairs.map(([source, target], index): GEdge => ({
  id: `e${String(index)}`,
  source,
  target,
  evidence: "",
  interactionType: "",
  detectionMethod: "",
  experimental: false,
}));
const index = buildGraphSelectionIndex(nodes, edges);

describe("graph selections", () => {
  it("selects all nodes and internal edges in components at the threshold", () => {
    const selected = selectSubgraphs(buildGraphSelectionIndex(nodes.slice(0, 5), edges), 5);
    expect(selected.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(["a", "b", "c", "d", "e"]));
    expect(selected.nodes).toHaveLength(5);
    expect(selected.edges).toHaveLength(5);
  });

  it("selects one largest component when multiple components tie", () => {
    const tiedNodes = ["a", "b", "x", "y"].map((id): GNode => ({ id, kind: "microbial" }));
    const tiedEdges = edges.filter((edge) => edge.id === "e0" || edge.id === "e6");
    const selected = selectSubgraphs(buildGraphSelectionIndex(tiedNodes, tiedEdges), "max");
    expect(selected.nodes).toHaveLength(2);
    expect(selected.edges).toHaveLength(1);
  });

  it("counts unique neighbors instead of parallel interactions for hub thresholds", () => {
    const parallel = { ...edges[0], id: "parallel" };
    const selected = selectHubs(buildGraphSelectionIndex(nodes, [...edges, parallel]), 5);
    expect(selected.nodes.map((node) => node.id)).toEqual(["a"]);
    expect(selected.edges).toEqual([]);
  });

  it("selects every protein tied for most connected without iterator helpers", () => {
    const values = index.neighbors.values.bind(index.neighbors);
    vi.spyOn(index.neighbors, "values").mockImplementation(() => {
      const iterator = values();
      Object.defineProperty(iterator, "map", { value: undefined });
      return iterator;
    });

    const selected = selectHubs(index, "max");
    expect(selected.nodes.map((node) => node.id)).toEqual(["a"]);
  });
});

describe("single selection refs", () => {
  it("resolves a node or edge id against the loaded graph", () => {
    expect(resolveGraphSelection(index, { kind: "node", id: "b" })).toEqual({
      nodes: [nodes[1]],
      edges: [],
    });
    expect(resolveGraphSelection(index, { kind: "edge", id: "e6" })).toEqual({
      nodes: [],
      edges: [edges[6]],
    });
  });

  it("resolves nothing for no ref or an id the loaded graph does not hold", () => {
    const empty = { nodes: [], edges: [] };
    expect(resolveGraphSelection(index, null)).toEqual(empty);
    expect(resolveGraphSelection(index, { kind: "node", id: "gone" })).toEqual(empty);
    expect(resolveGraphSelection(index, { kind: "edge", id: "a" })).toEqual(empty);
    expect(resolveGraphSelection(index, { kind: "node", id: "e0" })).toEqual(empty);
  });

  it("names a selection of exactly one node or one edge, and nothing else", () => {
    expect(singleSelectionRef({ nodes: [nodes[0]], edges: [] })).toEqual({
      kind: "node",
      id: "a",
    });
    expect(singleSelectionRef({ nodes: [], edges: [edges[2]] })).toEqual({
      kind: "edge",
      id: "e2",
    });
    expect(singleSelectionRef({ nodes: [], edges: [] })).toBeNull();
    expect(singleSelectionRef({ nodes: [nodes[0]], edges: [edges[0]] })).toBeNull();
    expect(singleSelectionRef({ nodes: nodes.slice(0, 2), edges: [] })).toBeNull();
  });

  it("selects the focused protein as a node, and nothing without a focus", () => {
    expect(focusSelectionRef("fig|1.1.peg.1")).toEqual({
      kind: "node",
      id: "fig|1.1.peg.1",
    });
    expect(focusSelectionRef(undefined)).toBeNull();
    expect(focusSelectionRef("")).toBeNull();
  });
});

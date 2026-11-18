import {
  applySelectionClick,
  buildIncidenceIndex,
  computeSelectionFocus,
  isAdditiveClick,
} from "../selection-focus";
import type { GEdge, GNode, GraphSelection } from "../types";

const a: GNode = { id: "a", kind: "microbial" };
const b: GNode = { id: "b", kind: "host" };
const c: GNode = { id: "c", kind: "microbial" };
const d: GNode = { id: "d", kind: "microbial" };

function edge(id: string, source: string, target: string): GEdge {
  return {
    id,
    source,
    target,
    evidence: "",
    interactionType: "",
    detectionMethod: "",
    experimental: false,
  };
}

const ab = edge("ab", "a", "b");
const abParallel = edge("ab2", "b", "a");
const ac = edge("ac", "a", "c");
const cc = edge("cc", "c", "c");
const edges = [ab, abParallel, ac, cc];

const empty: GraphSelection = { nodes: [], edges: [] };

describe("isAdditiveClick", () => {
  it("is true for Cmd or Ctrl and false otherwise", () => {
    expect(isAdditiveClick({ metaKey: true, ctrlKey: false })).toBe(true);
    expect(isAdditiveClick({ metaKey: false, ctrlKey: true })).toBe(true);
    expect(isAdditiveClick({ metaKey: false, ctrlKey: false })).toBe(false);
  });
});

describe("buildIncidenceIndex", () => {
  it("lists every incident edge once, parallel edges included", () => {
    const index = buildIncidenceIndex(edges);
    expect(index.get("a")?.map((e) => e.id)).toEqual(["ab", "ab2", "ac"]);
    expect(index.get("b")?.map((e) => e.id)).toEqual(["ab", "ab2"]);
  });

  it("lists a self-loop once and omits nodes with no edges", () => {
    const index = buildIncidenceIndex(edges);
    expect(index.get("c")?.map((e) => e.id)).toEqual(["ac", "cc"]);
    expect(index.has("d")).toBe(false);
  });
});

describe("computeSelectionFocus", () => {
  const index = buildIncidenceIndex(edges);

  it("is null when nothing is selected", () => {
    expect(computeSelectionFocus(index, empty)).toBeNull();
  });

  it("focuses a selected node's neighbours and incident edges", () => {
    const focus = computeSelectionFocus(index, { nodes: [a], edges: [] });
    expect([...(focus?.nodes ?? [])].sort()).toEqual(["a", "b", "c"]);
    expect([...(focus?.edges ?? [])].sort()).toEqual(["ab", "ab2", "ac"]);
  });

  it("focuses a selected edge's endpoints but no other edge", () => {
    const focus = computeSelectionFocus(index, { nodes: [], edges: [ac] });
    expect([...(focus?.nodes ?? [])].sort()).toEqual(["a", "c"]);
    expect(focus?.edges.size).toBe(0);
  });

  it("unions several selected nodes; an isolated selected node adds nothing", () => {
    const focus = computeSelectionFocus(index, { nodes: [b, d], edges: [] });
    expect([...(focus?.nodes ?? [])].sort()).toEqual(["a", "b"]);
    expect([...(focus?.edges ?? [])].sort()).toEqual(["ab", "ab2"]);
  });

  it("unions a selected node's surroundings with a selected edge's endpoints", () => {
    const focus = computeSelectionFocus(index, { nodes: [c], edges: [ab] });
    expect([...(focus?.nodes ?? [])].sort()).toEqual(["a", "b", "c"]);
    expect([...(focus?.edges ?? [])].sort()).toEqual(["ac", "cc"]);
  });

  it("treats a self-loop as its own neighbour", () => {
    const focus = computeSelectionFocus(index, { nodes: [c], edges: [] });
    expect([...(focus?.nodes ?? [])].sort()).toEqual(["a", "c"]);
    expect([...(focus?.edges ?? [])].sort()).toEqual(["ac", "cc"]);
  });
});

describe("applySelectionClick", () => {
  it("replaces the whole selection on a plain node click", () => {
    const next = applySelectionClick(
      { nodes: [a], edges: [ab] },
      { kind: "node", node: b },
      false,
    );
    expect(next).toEqual({ nodes: [b], edges: [] });
  });

  it("replaces the whole selection on a plain edge click", () => {
    const next = applySelectionClick(
      { nodes: [a, b], edges: [] },
      { kind: "edge", edge: ac },
      false,
    );
    expect(next).toEqual({ nodes: [], edges: [ac] });
  });

  it("adds a node on an additive click and keeps what was selected", () => {
    const next = applySelectionClick(
      { nodes: [a], edges: [ab] },
      { kind: "node", node: b },
      true,
    );
    expect(next).toEqual({ nodes: [a, b], edges: [ab] });
  });

  it("removes an already-selected node on an additive click", () => {
    const next = applySelectionClick(
      { nodes: [a, b], edges: [] },
      { kind: "node", node: a },
      true,
    );
    expect(next).toEqual({ nodes: [b], edges: [] });
  });

  it("toggles edges on an additive click and keeps the nodes", () => {
    const added = applySelectionClick(
      { nodes: [a], edges: [] },
      { kind: "edge", edge: ab },
      true,
    );
    expect(added).toEqual({ nodes: [a], edges: [ab] });
    const removed = applySelectionClick(
      added,
      { kind: "edge", edge: ab },
      true,
    );
    expect(removed).toEqual({ nodes: [a], edges: [] });
  });

  it("selects the node on an additive click from an empty selection", () => {
    const next = applySelectionClick(empty, { kind: "node", node: a }, true);
    expect(next).toEqual({ nodes: [a], edges: [] });
  });

  it("keeps the sole selected node selected on a plain click of it", () => {
    const next = applySelectionClick(
      { nodes: [a], edges: [] },
      { kind: "node", node: a },
      false,
    );
    expect(next).toEqual({ nodes: [a], edges: [] });
  });

  it("matches by id, so a node carrying extra canvas attributes still toggles off", () => {
    const withAttributes = { ...a, x: 1, y: 2 } as GNode;
    const next = applySelectionClick(
      { nodes: [withAttributes], edges: [] },
      { kind: "node", node: a },
      true,
    );
    expect(next).toEqual({ nodes: [], edges: [] });
  });
});

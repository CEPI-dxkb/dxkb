// @vitest-environment node
import Graph from "graphology";

import { buildLayoutRequest, computeLayoutPositions } from "../layout-positions";
import { runGraphLayout } from "../layouts";
import { allLayouts } from "../renderer-capabilities";
import type { GEdge, GNode, LayoutName } from "../types";

function node(id: string): GNode {
  return { id, kind: "microbial" };
}

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

// A hub with three spokes, a directed chain and a disconnected pair: enough
// structure for degree rings (concentric), ranks (dagre) and components.
const nodes = ["hub", "a", "b", "c", "d", "e", "pair-1", "pair-2"].map(node);
const edges = [
  edge("hub-a", "hub", "a"),
  edge("hub-b", "hub", "b"),
  edge("hub-c", "hub", "c"),
  edge("c-d", "c", "d"),
  edge("d-e", "d", "e"),
  // A repeated pair: graphology keeps both in a multi graph.
  edge("d-e-again", "d", "e"),
  edge("pair", "pair-1", "pair-2"),
];

/** The graph `buildGraph` in sigma-canvas.tsx builds, before its layout runs. */
function graphLikeBuildGraph(graphNodes: GNode[], graphEdges: GEdge[]) {
  const g = new Graph({ multi: true });
  for (const n of graphNodes) {
    g.addNode(n.id, { x: Math.random(), y: Math.random() });
  }
  for (const e of graphEdges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.addEdgeWithKey(e.id, e.source, e.target);
    }
  }
  return g;
}

describe("buildLayoutRequest", () => {
  it("maps edge endpoints to node indices", () => {
    const request = buildLayoutRequest(nodes, edges, "grid");

    expect(request.nodeCount).toBe(8);
    expect(request.layout).toBe("grid");
    expect(Array.from(request.edges)).toEqual([
      0, 1, 0, 2, 0, 3, 3, 4, 4, 5, 4, 5, 6, 7,
    ]);
  });

  it("drops edges whose endpoints are not both nodes", () => {
    const request = buildLayoutRequest(
      [node("a"), node("b")],
      [
        edge("a-b", "a", "b"),
        edge("a-ghost", "a", "ghost"),
        edge("ghost-b", "ghost", "b"),
        edge("b-a", "b", "a"),
      ],
      "forceatlas2",
    );

    expect(Array.from(request.edges)).toEqual([0, 1, 1, 0]);
  });
});

describe("computeLayoutPositions", () => {
  it.each(allLayouts)("returns 2n finite numbers for %s", (layout) => {
    const positions = computeLayoutPositions(
      buildLayoutRequest(nodes, edges, layout),
    );

    expect(positions).toBeInstanceOf(Float64Array);
    expect(positions).toHaveLength(2 * nodes.length);
    for (const value of positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it.each<LayoutName>(["grid", "concentric", "dagre"])(
    "matches runGraphLayout on the graph buildGraph builds for %s",
    (layout) => {
      const reference = graphLikeBuildGraph(nodes, edges);
      runGraphLayout(reference, layout);

      const positions = computeLayoutPositions(
        buildLayoutRequest(nodes, edges, layout),
      );

      nodes.forEach((n, i) => {
        expect([positions[2 * i], positions[2 * i + 1]]).toEqual([
          reference.getNodeAttribute(n.id, "x"),
          reference.getNodeAttribute(n.id, "y"),
        ]);
      });
    },
  );

  it("keeps the node list's order, which grid placement follows", () => {
    const forward = computeLayoutPositions(
      buildLayoutRequest(nodes, [], "grid"),
    );
    const reversed = computeLayoutPositions(
      buildLayoutRequest([...nodes].reverse(), [], "grid"),
    );

    // Grid places nodes row by row in insertion order: index 0 sits at the
    // origin whichever node it is, and the cells follow the list.
    expect(Array.from(forward.subarray(0, 6))).toEqual([0, 0, 1, 0, 2, 0]);
    expect(Array.from(reversed)).toEqual(Array.from(forward));
  });

  it("preserves edge direction, which dagre ranks by", () => {
    const chain = [node("x"), node("y"), node("z")];
    const down = computeLayoutPositions(
      buildLayoutRequest(chain, [edge("x-y", "x", "y"), edge("y-z", "y", "z")], "dagre"),
    );
    const up = computeLayoutPositions(
      buildLayoutRequest(chain, [edge("z-y", "z", "y"), edge("y-x", "y", "x")], "dagre"),
    );

    // The root (in-degree 0) takes the top rank: x in one, z in the other.
    expect(down[1]).toBeLessThan(down[5]);
    expect(up[5]).toBeLessThan(up[1]);
  });
});

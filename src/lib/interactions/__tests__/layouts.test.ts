import Graph from "graphology";

import { connectedComponents, runGraphLayout } from "../layouts";
import type { LayoutName } from "../types";

// Isolate cose-bilkent packing math from real force-directed physics so the giant component's
// pre-layout centroid is predictable.
vi.mock("graphology-layout-forceatlas2", () => ({ default: { assign: vi.fn() } }));

function makeGraph() {
  const g = new Graph({ multi: true });
  ["hub", "a", "b", "c", "pair-1", "pair-2"].forEach((node, i) => {
    g.addNode(node, { x: i % 3, y: Math.floor(i / 3) });
  });
  g.addEdgeWithKey("hub-a", "hub", "a");
  g.addEdgeWithKey("hub-b", "hub", "b");
  g.addEdgeWithKey("hub-c", "hub", "c");
  g.addEdgeWithKey("pair", "pair-1", "pair-2");
  return g;
}

function makeSkewedComponentsGraph() {
  const g = new Graph({ multi: true });
  g.addNode("gA", { x: 90, y: 0 });
  g.addNode("gB", { x: 110, y: 0 });
  g.addNode("gC", { x: 100, y: 0 });
  g.addEdgeWithKey("gA-gB", "gA", "gB");
  g.addEdgeWithKey("gB-gC", "gB", "gC");
  g.addNode("r1", { x: 0, y: 0 });
  g.addNode("r2", { x: 2, y: 0 });
  g.addEdgeWithKey("r1-r2", "r1", "r2");
  return g;
}

function expectFinitePositions(g: Graph) {
  g.forEachNode((node) => {
    expect(g.getNodeAttribute(node, "x")).toEqual(expect.any(Number));
    expect(g.getNodeAttribute(node, "y")).toEqual(expect.any(Number));
    expect(Number.isFinite(g.getNodeAttribute(node, "x") as number)).toBe(true);
    expect(Number.isFinite(g.getNodeAttribute(node, "y") as number)).toBe(true);
  });
}

describe("interaction graph layouts", () => {
  it("finds connected components without merging disconnected clusters", () => {
    const components = connectedComponents(makeGraph()).map((component) => component.sort());

    expect(components).toHaveLength(2);
    expect(components).toContainEqual(["a", "b", "c", "hub"]);
    expect(components).toContainEqual(["pair-1", "pair-2"]);
  });

  it.each<LayoutName>(["grid", "concentric", "dagre", "circular", "random", "forceatlas2", "cose-bilkent", "cola"])(
    "assigns finite positions for %s",
    (layout) => {
      const g = makeGraph();

      runGraphLayout(g, layout);

      expect(g.order).toBe(6);
      expect(g.size).toBe(4);
      expectFinitePositions(g);
    },
  );

  it("puts the unique highest-degree node at the centre of the concentric layout", () => {
    const g = makeGraph();

    runGraphLayout(g, "concentric");

    expect(g.getNodeAttribute("hub", "x")).toBeCloseTo(0);
    expect(g.getNodeAttribute("hub", "y")).toBeCloseTo(0);
  });

  it("packs a disconnected cluster near the giant component's post-translation radius (cose-bilkent)", () => {
    const g = makeSkewedComponentsGraph();

    runGraphLayout(g, "cose-bilkent");

    // The small cluster must stay within a small multiple of the giant's true post-translation
    // radius (10); measuring from the stale pre-translation centroid inflated it ~10x.
    const r1 = g.getNodeAttributes("r1");
    const r2 = g.getNodeAttributes("r2");
    const centroidDist = Math.hypot(
      ((r1.x as number) + (r2.x as number)) / 2,
      ((r1.y as number) + (r2.y as number)) / 2,
    );

    expect(centroidDist).toBeLessThan(30);
  });
});

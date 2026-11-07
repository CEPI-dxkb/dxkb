import Graph from "graphology";

import { runGraphLayout } from "./layouts";
import type { GEdge, GNode, LayoutName } from "./types";

// Pure on purpose: the layout worker (graph-layout.worker.ts) imports this, so
// it must not reach React or the DOM.

/**
 * One layout job, in the shape that crosses to the worker: nodes as indices
 * into the caller's node list, edges as `[sourceIndex, targetIndex]` pairs in
 * a transferable buffer.
 */
export interface GraphLayoutRequest {
  nodeCount: number;
  edges: Uint32Array;
  layout: LayoutName;
}

/** The worker's reply: positions `[x0, y0, x1, y1, …]`, or why it failed. */
export type GraphLayoutResponse =
  | { positions: Float64Array }
  | { error: string };

/**
 * Index a graph for layout. Edges with an endpoint outside `nodes` are dropped,
 * as `buildGraph` (sigma-canvas.tsx) drops them with `hasNode`.
 */
export function buildLayoutRequest(
  nodes: GNode[],
  edges: GEdge[],
  layout: LayoutName,
): GraphLayoutRequest {
  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => {
    indexById.set(node.id, index);
  });
  const pairs: number[] = [];
  for (const edge of edges) {
    const source = indexById.get(edge.source);
    const target = indexById.get(edge.target);
    if (source !== undefined && target !== undefined) pairs.push(source, target);
  }
  return { nodeCount: nodes.length, edges: Uint32Array.from(pairs), layout };
}

/**
 * Run `runGraphLayout` over the indexed graph and read the positions back in
 * node order. The graph is built the way `buildGraph` builds the rendered one
 * (multi, directed, random seed positions, insertion order = node order),
 * because grid, concentric and dagre follow insertion order and dagre reads
 * edge direction.
 */
export function computeLayoutPositions(request: GraphLayoutRequest): Float64Array {
  const { nodeCount, edges, layout } = request;
  const graph = new Graph({ multi: true });
  for (let index = 0; index < nodeCount; index += 1) {
    graph.addNode(String(index), { x: Math.random(), y: Math.random() });
  }
  for (let pair = 0; pair < edges.length / 2; pair += 1) {
    graph.addDirectedEdgeWithKey(
      String(pair),
      String(edges[2 * pair]),
      String(edges[2 * pair + 1]),
    );
  }

  runGraphLayout(graph, layout);

  const positions = new Float64Array(2 * nodeCount);
  for (let index = 0; index < nodeCount; index += 1) {
    const attributes = graph.getNodeAttributes(String(index));
    positions[2 * index] = attributes.x as number;
    positions[2 * index + 1] = attributes.y as number;
  }
  return positions;
}

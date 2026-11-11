import Graph from "graphology";

import { runGraphLayout } from "./layouts";
import type { GEdge, GNode, LayoutName } from "./types";

// Pure on purpose: the layout worker imports this, so it must not reach React or the DOM.

export interface GraphLayoutRequest {
  nodeCount: number;
  edges: Uint32Array;
  layout: LayoutName;
}

export type GraphLayoutResponse =
  | { positions: Float64Array }
  | { error: string };

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
 * The graph is built the way `buildGraph` builds the rendered one, because grid, concentric and
 * dagre follow insertion order and dagre reads edge direction.
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

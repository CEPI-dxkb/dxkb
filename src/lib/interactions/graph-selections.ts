import Graph from "graphology";

import type {
  GEdge,
  GNode,
  GraphSelection,
  GraphSelectionRef,
  HubSelection,
  SubgraphSelection,
} from "./types";

interface GraphSelectionIndex {
  components: string[][];
  neighbors: Map<string, Set<string>>;
  nodesById: Map<string, GNode>;
  edges: GEdge[];
}

export function buildGraphSelectionIndex(nodes: GNode[], edges: GEdge[]): GraphSelectionIndex {
  const graph = new Graph({ multi: true });
  const neighbors = new Map(nodes.map((node) => [node.id, new Set<string>()]));

  for (const node of nodes) graph.addNode(node.id);
  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    graph.addEdgeWithKey(edge.id, edge.source, edge.target);
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }

  const components: string[][] = [];
  const visited = new Set<string>();
  for (const root of graph.nodes()) {
    if (visited.has(root)) continue;
    const component: string[] = [];
    const stack = [root];
    visited.add(root);
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) break;
      component.push(node);
      for (const neighbor of graph.neighbors(node)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(component);
  }

  return { components, neighbors, nodesById: new Map(nodes.map((node) => [node.id, node])), edges };
}

function selectionFromNodeIds(index: GraphSelectionIndex, nodeIds: Set<string>, includeEdges: boolean): GraphSelection {
  return {
    nodes: [...nodeIds].flatMap((id) => {
      const node = index.nodesById.get(id);
      return node ? [node] : [];
    }),
    edges: includeEdges
      ? index.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      : [],
  };
}

export function selectSubgraphs(index: GraphSelectionIndex, threshold: SubgraphSelection): GraphSelection {
  let matching: string[][];
  if (threshold === "max") {
    const largest = index.components.reduce<string[] | undefined>(
      (current, component) => !current || component.length > current.length ? component : current,
      undefined,
    );
    matching = largest ? [largest] : [];
  } else {
    matching = index.components.filter((component) => component.length >= threshold);
  }
  return selectionFromNodeIds(index, new Set(matching.flat()), true);
}

export function selectHubs(index: GraphSelectionIndex, threshold: HubSelection): GraphSelection {
  const maxDegree = Math.max(0, ...Array.from(index.neighbors.values(), (neighbors) => neighbors.size));
  const nodeIds = new Set<string>();
  for (const [id, neighbors] of index.neighbors) {
    if (threshold === "max" ? neighbors.size === maxDegree : neighbors.size >= threshold) nodeIds.add(id);
  }
  return selectionFromNodeIds(index, nodeIds, false);
}

/** An id the loaded graph does not hold (a stale or hand-edited URL) resolves to no selection. */
export function resolveGraphSelection(
  index: GraphSelectionIndex,
  ref: GraphSelectionRef | null,
): GraphSelection {
  if (ref?.kind === "node") {
    const node = index.nodesById.get(ref.id);
    return { nodes: node ? [node] : [], edges: [] };
  }
  if (ref?.kind === "edge") {
    const edge = index.edges.find((candidate) => candidate.id === ref.id);
    return { nodes: [], edges: edge ? [edge] : [] };
  }
  return { nodes: [], edges: [] };
}

/** Exactly one node or one edge; any other selection has no single id. */
export function singleSelectionRef(
  selection: GraphSelection,
): GraphSelectionRef | null {
  const { nodes, edges } = selection;
  if (nodes.length === 1 && edges.length === 0) {
    return { kind: "node", id: nodes[0].id };
  }
  if (nodes.length === 0 && edges.length === 1) {
    return { kind: "edge", id: edges[0].id };
  }
  return null;
}

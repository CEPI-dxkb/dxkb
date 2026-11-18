import type { GEdge, GNode, GraphSelection } from "./types";

export type SelectionTarget =
  | { kind: "node"; node: GNode }
  | { kind: "edge"; edge: GEdge };

/** What stays lit while something is selected; everything else is dimmed. */
export interface SelectionFocus {
  /** Neighbours of selected nodes, plus the endpoints of selected edges. */
  nodes: ReadonlySet<string>;
  /** Every edge touching a selected node. */
  edges: ReadonlySet<string>;
}

export type IncidenceIndex = ReadonlyMap<string, readonly GEdge[]>;

/** MouseEvent and TouchEvent both carry these; a touch tap reports them false. */
export function isAdditiveClick(original: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return original.metaKey || original.ctrlKey;
}

/** Node id to its incident edges (parallel edges included, a self-loop listed once). */
export function buildIncidenceIndex(
  edges: readonly GEdge[],
): Map<string, GEdge[]> {
  const index = new Map<string, GEdge[]>();
  const add = (nodeId: string, edge: GEdge) => {
    const list = index.get(nodeId);
    if (list) list.push(edge);
    else index.set(nodeId, [edge]);
  };
  for (const edge of edges) {
    add(edge.source, edge);
    if (edge.target !== edge.source) add(edge.target, edge);
  }
  return index;
}

/** Null for an empty selection, so callers can skip dimming entirely. */
export function computeSelectionFocus(
  incidence: IncidenceIndex,
  selection: GraphSelection,
): SelectionFocus | null {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return null;
  }
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const node of selection.nodes) {
    for (const edge of incidence.get(node.id) ?? []) {
      edges.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }
  for (const edge of selection.edges) {
    nodes.add(edge.source);
    nodes.add(edge.target);
  }
  return { nodes, edges };
}

/** Plain click replaces the selection; an additive click toggles just that item (matched by id). */
export function applySelectionClick(
  selection: GraphSelection,
  target: SelectionTarget,
  additive: boolean,
): GraphSelection {
  if (target.kind === "node") {
    if (!additive) return { nodes: [target.node], edges: [] };
    const present = selection.nodes.some((node) => node.id === target.node.id);
    return {
      nodes: present
        ? selection.nodes.filter((node) => node.id !== target.node.id)
        : [...selection.nodes, target.node],
      edges: selection.edges,
    };
  }
  if (!additive) return { nodes: [], edges: [target.edge] };
  const present = selection.edges.some((edge) => edge.id === target.edge.id);
  return {
    nodes: selection.nodes,
    edges: present
      ? selection.edges.filter((edge) => edge.id !== target.edge.id)
      : [...selection.edges, target.edge],
  };
}

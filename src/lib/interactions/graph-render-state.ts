import type {
  GraphEdgeState,
  GraphNodeState,
  GraphSigma,
} from "./graph-render-config";
import type { SelectionFocus } from "./selection-focus";

/** What the Graph's highlight styles are computed from: the selection and its lit surroundings. */
export interface RenderInputs {
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  focus: SelectionFocus | null;
}

/**
 * A node's highlight state. Precedence (selected > hover > focus > dim) lives in the style rules'
 * order; this only says which flags hold. A selected node is never dimmed, even when it is absent
 * from the focus (an isolated selected node).
 */
export function nodeStateFor(id: string, inputs: RenderInputs): GraphNodeState {
  const isSelected = inputs.selectedNodeIds.has(id);
  const isFocus = inputs.focus?.nodes.has(id) ?? false;
  return {
    isSelected,
    isPill: isSelected && inputs.selectedNodeIds.size === 1,
    isFocus,
    isDimmed: inputs.focus !== null && !isFocus && !isSelected,
  };
}

/** An edge's highlight state; hover is Sigma's own `isHovered`. */
export function edgeStateFor(id: string, inputs: RenderInputs): GraphEdgeState {
  const isFocus = inputs.focus?.edges.has(id) ?? false;
  return {
    isSelected: inputs.selectedEdgeIds.has(id),
    isFocus,
    isDimmed: inputs.focus !== null && !isFocus,
  };
}

/**
 * Writes every item's highlight state into Sigma. It walks the graph's own nodes and edges, never
 * the selection: Sigma throws on its next frame for state set on a key the graph lacks (a selection
 * restored from the URL can name a protein the current rows no longer hold). Sigma skips unchanged
 * values and re-evaluates only the items that changed on its next frame, so no refresh is asked for.
 */
export function syncRenderState(sigma: GraphSigma, inputs: RenderInputs): void {
  const graph = sigma.getGraph();
  graph.forEachNode((id) => {
    sigma.setNodeState(id, nodeStateFor(id, inputs));
  });
  graph.forEachEdge((id) => {
    sigma.setEdgeState(id, edgeStateFor(id, inputs));
  });
}

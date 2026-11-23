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
 * A node's highlight state. Which flag wins lives in the style rules' order (see
 * `buildSigmaOptions`); this only says which flags hold. A selected node is never dimmed, even
 * when it is absent from the focus (an isolated selected node).
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

const noInputs: RenderInputs = {
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  focus: null,
};

/** A dim batch waiting for its frame: the `isDimmed` it will give every non-member. */
interface PendingRest {
  restDimmed: boolean;
  cancel: () => void;
}

/**
 * What a Sigma instance holds, so a sync writes only what changed. `inputs` are the selection and
 * focus whose items ("members") were last written in full. Every other item holds all flags false
 * except `isDimmed`, which is `restDimmed` for all of them, or unknown (`null`) while a batch that
 * sets it is `pending`.
 */
interface AppliedState {
  inputs: RenderInputs;
  restDimmed: boolean | null;
  pending: PendingRest | null;
}

const appliedStates = new WeakMap<GraphSigma, AppliedState>();

const dimmed = { isDimmed: true } as const;
const undimmed = { isDimmed: false } as const;

function isNodeMember(id: string, inputs: RenderInputs): boolean {
  return (
    inputs.selectedNodeIds.has(id) || (inputs.focus?.nodes.has(id) ?? false)
  );
}

function isEdgeMember(id: string, inputs: RenderInputs): boolean {
  return (
    inputs.selectedEdgeIds.has(id) || (inputs.focus?.edges.has(id) ?? false)
  );
}

function memberIds(
  inputs: RenderInputs,
  kind: "nodes" | "edges",
  into: Set<string>,
): void {
  const selected =
    kind === "nodes" ? inputs.selectedNodeIds : inputs.selectedEdgeIds;
  for (const id of selected) into.add(id);
  for (const id of inputs.focus?.[kind] ?? []) into.add(id);
}

/**
 * Writes the full state of every item that is a member before or after the change: the old and new
 * selection and focus. Only these can change anything but `isDimmed`. A key the graph lacks is
 * skipped, because Sigma throws on its next frame for state set on one (a selection restored from
 * the URL can name a protein the current rows no longer hold).
 */
function writeMembers(
  sigma: GraphSigma,
  previous: RenderInputs,
  next: RenderInputs,
): void {
  const graph = sigma.getGraph();
  const nodeIds = new Set<string>();
  memberIds(previous, "nodes", nodeIds);
  memberIds(next, "nodes", nodeIds);
  for (const id of nodeIds) {
    if (graph.hasNode(id)) sigma.setNodeState(id, nodeStateFor(id, next));
  }
  const edgeIds = new Set<string>();
  memberIds(previous, "edges", edgeIds);
  memberIds(next, "edges", edgeIds);
  for (const id of edgeIds) {
    if (graph.hasEdge(id)) sigma.setEdgeState(id, edgeStateFor(id, next));
  }
}

/** Dims (or un-dims) every non-member item in one batch per kind, walking the graph's own items. */
function writeRest(sigma: GraphSigma, inputs: RenderInputs): void {
  const graph = sigma.getGraph();
  const state = inputs.focus === null ? undimmed : dimmed;
  const nodeIds: string[] = [];
  graph.forEachNode((id) => {
    if (!isNodeMember(id, inputs)) nodeIds.push(id);
  });
  sigma.setNodesState(nodeIds, state);
  const edgeIds: string[] = [];
  graph.forEachEdge((id) => {
    if (!isEdgeMember(id, inputs)) edgeIds.push(id);
  });
  sigma.setEdgesState(edgeIds, state);
}

/**
 * Runs `run` in a task after the next frame. A callback queued now runs after the frame Sigma
 * already asked for (the members' state), so that frame is painted first.
 */
function afterNextFrame(run: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(run, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

/** Writes a waiting dim batch for the latest inputs, which is what it was waiting to do. */
function runPending(sigma: GraphSigma, applied: AppliedState): void {
  applied.pending = null;
  writeRest(sigma, applied.inputs);
  applied.restDimmed = applied.inputs.focus !== null;
}

/**
 * Brings Sigma's item state in line with `inputs`, writing only what can have changed. Sigma skips
 * unchanged values and re-evaluates only the items written on its next frame, so no refresh is
 * asked for.
 *
 * A change within one focus mode (a selection replacing another, a Cmd-click) writes only the old
 * and new members. Entering or leaving a focus flips `isDimmed` on every other item, which costs
 * Sigma a style evaluation per item that no state layout avoids (Sigma has no per-layer or global
 * dim, and a graph-state rule would re-evaluate every item on each pan, zoom and hover). That batch
 * is written in the task after the next frame, so the frame that answers the click shows the
 * selection and its focus first. A sync before it lands keeps it when it still dims the same way
 * (it then writes for the latest inputs, so an equal re-sync does not push the dim back a frame),
 * and replaces it otherwise. After a reload (`reloaded`), Sigma holds no state, and everything is
 * written at once: a load is not a click waiting for its answer.
 */
export function syncRenderState(
  sigma: GraphSigma,
  inputs: RenderInputs,
  { reloaded = false }: { reloaded?: boolean } = {},
): void {
  let applied = appliedStates.get(sigma);
  if (reloaded || applied === undefined) {
    applied?.pending?.cancel();
    applied = { inputs: noInputs, restDimmed: false, pending: null };
    appliedStates.set(sigma, applied);
  }
  writeMembers(sigma, applied.inputs, inputs);
  applied.inputs = inputs;
  const restDimmed = inputs.focus !== null;
  if (applied.pending !== null) {
    if (applied.pending.restDimmed === restDimmed) return;
    applied.pending.cancel();
    applied.pending = null;
  }
  if (applied.restDimmed === restDimmed) return;
  if (reloaded) {
    writeRest(sigma, inputs);
    applied.restDimmed = restDimmed;
    return;
  }
  const target = applied;
  target.restDimmed = null;
  target.pending = {
    restDimmed,
    cancel: afterNextFrame(() => {
      runPending(sigma, target);
    }),
  };
}

/**
 * Writes a waiting dim batch now. The PNG export copies Sigma's item state when it is called, so
 * an export inside the batch's frame would otherwise miss the dim (or keep a cleared one).
 */
export function flushRenderSync(sigma: GraphSigma): void {
  const applied = appliedStates.get(sigma);
  if (!applied?.pending) return;
  applied.pending.cancel();
  runPending(sigma, applied);
}

/** Drops a waiting dim batch, for a canvas that is going away. */
export function cancelRenderSync(sigma: GraphSigma): void {
  const applied = appliedStates.get(sigma);
  if (!applied?.pending) return;
  applied.pending.cancel();
  applied.pending = null;
}

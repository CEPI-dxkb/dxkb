/**
 * The Interactions tab's Table/Graph state, kept in the URL so Back from a
 * linked page (or a reload) reopens the same subview, keyword, selection,
 * layout and camera.
 * The prefix is `interactionsGraph.`, not `interactions.`: the Table's writer
 * (`replaceChildCollectionSearchParams`) rewrites every `interactions.*` param.
 * `interactionsGraph` is a `childCollectionUrlKeys` entry, so switching tabs
 * clears these like any tab-owned param. Written with `replaceState` only, so
 * a click adds no Back step.
 */
import { replaceQuery } from "@/lib/url";

import { allLayouts, defaultLayout } from "./renderer-capabilities";
import type { GraphCameraView, GraphSelectionRef, LayoutName } from "./types";

export type InteractionsSubview = "table" | "graph";

export interface InteractionsGraphUrlState {
  view: InteractionsSubview;
  /** Shared by both subviews; the selection only means something against the same dataset. */
  keyword: string;
  /** One node or edge; a bulk selection (Sub-Graph, Hub) is not kept. */
  selected: GraphSelectionRef | null;
  layout: LayoutName;
  /** Means something only for this layout and dataset, so either changing drops it. */
  camera: GraphCameraView | null;
}

export const defaultInteractionsGraphUrlState: InteractionsGraphUrlState = {
  view: "table",
  keyword: "",
  selected: null,
  layout: defaultLayout,
  camera: null,
};

export const interactionsGraphUrlParams = {
  view: "interactionsGraph.view",
  keyword: "interactionsGraph.q",
  node: "interactionsGraph.node",
  edge: "interactionsGraph.edge",
  layout: "interactionsGraph.layout",
  camera: "interactionsGraph.cam",
} as const;

/** Sigma's camera is unbounded; past these a value is garbage, not a zoom anyone chose. */
const cameraRatioBounds = { min: 0.001, max: 100 } as const;
const cameraOffsetBound = 10;
const plainDecimal = /^-?\d+(\.\d+)?$/;
const defaultCamera = { ratio: 1, x: 0.5, y: 0.5 } as const;

function parseLayout(value: string | null): LayoutName {
  return allLayouts.find((name) => name === value) ?? defaultLayout;
}

function parseCamera(value: string | null): GraphCameraView | null {
  const parts = value?.split(",") ?? [];
  if (parts.length !== 3 || !parts.every((part) => plainDecimal.test(part))) {
    return null;
  }
  const [ratio, x, y] = parts.map(Number);
  const inBounds =
    ratio >= cameraRatioBounds.min &&
    ratio <= cameraRatioBounds.max &&
    Math.abs(x) <= cameraOffsetBound &&
    Math.abs(y) <= cameraOffsetBound;
  return inBounds ? { ratio, x, y } : null;
}

function formatCamera(camera: GraphCameraView): string {
  return [camera.ratio, camera.x, camera.y].map(String).join(",");
}

/**
 * A live camera state as the URL keeps it: the ratio to 6 significant digits (it spans orders of
 * magnitude, and 4 moved a stepped zoom such as 337.5% across the control's rounding), the position
 * to 4 decimals, and `null` for the default framing.
 */
export function cameraUrlView(state: GraphCameraView): GraphCameraView | null {
  const ratio = Number(
    Math.min(
      cameraRatioBounds.max,
      Math.max(cameraRatioBounds.min, state.ratio),
    ).toPrecision(6),
  );
  const round = (value: number) =>
    Math.round(
      Math.min(cameraOffsetBound, Math.max(-cameraOffsetBound, value)) * 1e4,
    ) / 1e4;
  const view = { ratio, x: round(state.x), y: round(state.y) };
  const isDefault =
    view.ratio === defaultCamera.ratio &&
    view.x === defaultCamera.x &&
    view.y === defaultCamera.y;
  return isDefault ? null : view;
}

function selectedRef(
  params: Pick<URLSearchParams, "get">,
): GraphSelectionRef | null {
  const node = params.get(interactionsGraphUrlParams.node);
  if (node) return { kind: "node", id: node };
  const edge = params.get(interactionsGraphUrlParams.edge);
  if (edge) return { kind: "edge", id: edge };
  return null;
}

export function parseInteractionsGraphUrlState(
  params: Pick<URLSearchParams, "get">,
): InteractionsGraphUrlState {
  return {
    view:
      params.get(interactionsGraphUrlParams.view) === "graph"
        ? "graph"
        : "table",
    keyword: params.get(interactionsGraphUrlParams.keyword) ?? "",
    selected: selectedRef(params),
    layout: parseLayout(params.get(interactionsGraphUrlParams.layout)),
    camera: parseCamera(params.get(interactionsGraphUrlParams.camera)),
  };
}

function setOrDelete(params: URLSearchParams, name: string, value: string) {
  if (value) params.set(name, value);
  else params.delete(name);
}

/** Applies only the fields `change` names; defaults are omitted from the URL. */
export function applyInteractionsGraphUrlState(
  params: URLSearchParams,
  change: Partial<InteractionsGraphUrlState>,
): void {
  if (change.view !== undefined) {
    setOrDelete(
      params,
      interactionsGraphUrlParams.view,
      change.view === "graph" ? "graph" : "",
    );
  }
  if (change.keyword !== undefined) {
    setOrDelete(params, interactionsGraphUrlParams.keyword, change.keyword);
  }
  if (change.selected !== undefined) {
    const { selected } = change;
    setOrDelete(
      params,
      interactionsGraphUrlParams.node,
      selected?.kind === "node" ? selected.id : "",
    );
    setOrDelete(
      params,
      interactionsGraphUrlParams.edge,
      selected?.kind === "edge" ? selected.id : "",
    );
  }
  if (change.layout !== undefined) {
    setOrDelete(
      params,
      interactionsGraphUrlParams.layout,
      change.layout === defaultLayout ? "" : change.layout,
    );
  }
  if (change.camera !== undefined) {
    setOrDelete(
      params,
      interactionsGraphUrlParams.camera,
      change.camera ? formatCamera(change.camera) : "",
    );
  }
}

/** Merges onto the live URL (a write Next has not rendered yet survives) and keeps the hash. */
export function writeInteractionsGraphUrlState(
  change: Partial<InteractionsGraphUrlState>,
): void {
  replaceQuery((params) => {
    applyInteractionsGraphUrlState(params, change);
  });
}

export function readLiveInteractionsGraphUrlState(): InteractionsGraphUrlState {
  return parseInteractionsGraphUrlState(
    new URLSearchParams(window.location.search),
  );
}

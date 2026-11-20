import type { RefObject } from "react";

import type { IncidenceIndex } from "./selection-focus";

export type { PpiRecord } from "./schema";

export interface GNode {
  id: string;
  interactorType?: string;
  interactorDesc?: string;
  featureId?: string;
  gene?: string;
  genomeId?: string;
  genome?: string;
  refseqLocusTag?: string;
  kind: "microbial" | "host";
}

export interface GEdge {
  id: string;
  source: string;
  target: string;
  evidence: string;
  interactionType: string;
  detectionMethod: string;
  experimental: boolean;
}

export type LayoutName =
  | "cola"
  | "cose-bilkent"
  | "dagre"
  | "grid"
  | "concentric"
  | "random"
  | "forceatlas2"
  | "circular";

export type SubgraphSelection = 5 | 10 | 20 | "max";
export type HubSelection = 3 | 4 | 5 | 10 | "max";

export interface GraphSelection {
  nodes: GNode[];
  edges: GEdge[];
}

/** One selected node or edge by id (`GNode.id` / `GEdge.id`), the form the URL keeps. */
export interface GraphSelectionRef {
  kind: "node" | "edge";
  id: string;
}

/** A Sigma camera position (normalized graph space); the URL keeps it rounded. */
export interface GraphCameraView {
  ratio: number;
  x: number;
  y: number;
}

export interface GraphCanvasHandle {
  exportPng: () => void;
}

export interface GraphCanvasProps {
  nodes: GNode[];
  edges: GEdge[];
  // The graph's incidence index, built once by the owner so the canvas's focus and the details pane
  // share it.
  incidence: IncidenceIndex;
  positions: Float64Array | null;
  // Controlled selection: the canvas syncs every item's highlight state from this so keyboard
  // selection highlights what a canvas click would.
  selection: GraphSelection;
  onSelect: (sel: GraphSelection) => void;
  handleRef: RefObject<GraphCanvasHandle | null>;
  onReady?: () => void;
  /** Applied once, on the first graph load after mount; later loads (new rows) re-fit instead. */
  camera?: GraphCameraView | null;
  /** Debounced; `null` for the default framing. */
  onCameraChange?: (camera: GraphCameraView | null) => void;
}

import type { RefObject } from "react";

import type { IncidenceIndex } from "./selection-focus";

export type { PpiRecord } from "./schema";

export interface GNode {
  id: string;
  interactorType?: string;
  interactorDesc?: string;
  featureId?: string;
  gene?: string;
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
  // Controlled selection: the highlight reducer reads this so keyboard selection highlights what a
  // canvas click would.
  selection: GraphSelection;
  onSelect: (sel: GraphSelection) => void;
  handleRef: RefObject<GraphCanvasHandle | null>;
  onReady?: () => void;
}

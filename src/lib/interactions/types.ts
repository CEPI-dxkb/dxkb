import type { RefObject } from "react";

// A PPI row's shape is owned by the zod schema that validates it, so the graph
// cannot drift from what it actually accepts off the wire.
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
  runLayout: (name: LayoutName) => void;
  exportPng: () => void;
}

export interface GraphCanvasProps {
  nodes: GNode[];
  edges: GEdge[];
  layout: LayoutName;
  // Controlled selection: the canvas highlight reducer reads this so keyboard
  // selection (node list / edge list) highlights the same node/edge a canvas
  // click would. onSelect reports selections back out.
  selection: GraphSelection;
  onSelect: (sel: GraphSelection) => void;
  handleRef: RefObject<GraphCanvasHandle | null>;
  onReady?: () => void;
}

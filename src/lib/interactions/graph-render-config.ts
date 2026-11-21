import type Graph from "graphology";
import type Sigma from "sigma";
import { DEPTHLESS_STYLES } from "sigma";
import { layerPlain, pathLine } from "sigma/rendering";
import type { PrimitivesDeclaration, SigmaOptions } from "sigma/types";

import {
  colors,
  edgeDimColor,
  edgeHoverColor,
  nodeDimColor,
} from "./graph-theme";

/** Graphology's attribute record (`graphology-types` is not a direct dependency). */
export type Attrs = ReturnType<Graph["getNodeAttributes"]>;

/**
 * No custom graph-level state (react-sigma's default slot type): every highlight is per item, so a
 * pan or zoom re-evaluates nothing. Even the dim stays per item: Sigma re-evaluates every item of
 * a style that reads graph state whenever any graph-state flag changes, and each pan, zoom and
 * hover flips one (`syncRenderState` keeps the dim's cost to a focus change instead).
 */
export type GraphLevelState = unknown;

/**
 * Per-node highlight flags, set by `syncRenderState`. Hover is Sigma's built-in `isHovered`.
 * `isPill` marks a lone selected node, whose label stays in the white pill (v3's `highlighted`).
 */
export interface GraphNodeState {
  isSelected: boolean;
  isPill: boolean;
  isFocus: boolean;
  isDimmed: boolean;
}

/** Per-edge highlight flags; hover is Sigma's built-in `isHovered` (edge events are on). */
export interface GraphEdgeState {
  isSelected: boolean;
  isFocus: boolean;
  isDimmed: boolean;
}

/**
 * Straight edges only (no self-loop path: a self-interaction draws as a zero-length line, as in
 * v3). Draw order is array order, so every edge sits under every node, and within each kind the
 * base and dimmed items sit under the focus, which sits under the selected and hovered ones.
 * `edges`, `topEdges`, `nodes` and `topNodes` keep the names Sigma's own defaults use.
 */
export const primitives = {
  edges: { paths: [pathLine()], layers: [layerPlain()] },
  depthLayers: [
    "edges",
    "focusEdges",
    "topEdges",
    "nodes",
    "focusNodes",
    "topNodes",
  ],
} as const satisfies PrimitivesDeclaration;

export type GraphPrimitives = typeof primitives;

export type GraphSigmaOptions = SigmaOptions<
  Attrs,
  Attrs,
  Attrs,
  GraphNodeState,
  GraphEdgeState,
  GraphLevelState,
  GraphPrimitives
>;

export type GraphSigma = Sigma<
  Attrs,
  Attrs,
  Attrs,
  GraphNodeState,
  GraphEdgeState,
  GraphLevelState,
  GraphPrimitives
>;

// Sigma's hover pill is white, so a label inside it is dark in every theme.
const pillLabelColor = "#000";

/**
 * The Graph's Sigma options. Highlights are `whenState` rules over the flags above, so Sigma
 * re-evaluates only the items whose state changed (a `when:` function or a reducer would re-run on
 * every pan, zoom and hover), and they reach the exported PNG. Later rules win: dim < focus <
 * hover < selected for edges; for nodes the selected color beats the dim, and hover only lifts
 * and darkens the label. Built once per canvas: `SigmaContainer` rebuilds Sigma, dropping item
 * state, whenever its `options` differ.
 */
export function buildSigmaOptions(): GraphSigmaOptions {
  return {
    settings: {
      renderEdgeLabels: false,
      enableEdgeEvents: true,
      // v3 sizes: a node's `size` is screen pixels at the default zoom, not layout units.
      itemSizesReference: "screen",
      // Sigma 4's default (1.7) would draw the 1px mesh and the 1.5px focus edges alike.
      minEdgeThickness: 1,
      // No camera rotation: the `cam=` URL stores no angle. Right-drag is `enableCameraMouseRotation`;
      // `enableCameraRotation` (default true) is what lets a two-finger twist turn the camera.
      enableCameraRotation: false,
      enableCameraMouseRotation: false,
    },
    primitives,
    customNodeState: {
      isSelected: false,
      isPill: false,
      isFocus: false,
      isDimmed: false,
    },
    customEdgeState: { isSelected: false, isFocus: false, isDimmed: false },
    styles: {
      // DEPTHLESS_STYLES: Sigma's defaults (attribute bindings, hover pill) without its depth
      // rules, which assume the four default layers; depth is assigned below.
      nodes: [
        DEPTHLESS_STYLES.nodes,
        {
          labelColor: { attribute: "labelColor" },
          // v3's label font (Sigma 4 defaults to 12px sans-serif, whose `|` in `fig|…` is
          // hairline-thin), and a pill shaped like v3's: text close to the box, and a shadow
          // about as soft as v3's canvas `shadowBlur: 8` (Sigma 4's default is twice as heavy).
          labelFont: "Arial",
          labelSize: 14,
          backdropLabelPadding: 2,
          backdropShadowBlur: 7,
        },
        { whenState: "isFocus", then: { depth: "focusNodes" } },
        {
          whenState: "isDimmed",
          then: { color: nodeDimColor, labelVisibility: "hidden" },
        },
        {
          whenState: "isSelected",
          then: { color: colors.selected, depth: "topNodes" },
        },
        {
          whenState: "isPill",
          then: {
            labelVisibility: "visible",
            backdropVisibility: "visible",
            labelColor: pillLabelColor,
          },
        },
        {
          whenState: "isHovered",
          then: { labelColor: pillLabelColor, depth: "topNodes" },
        },
      ],
      edges: [
        DEPTHLESS_STYLES.edges,
        { whenState: "isDimmed", then: { color: edgeDimColor } },
        {
          whenState: "isFocus",
          then: {
            color: { attribute: "focusColor" },
            size: 1.5,
            depth: "focusEdges",
          },
        },
        {
          whenState: "isHovered",
          then: { color: edgeHoverColor, size: 2, depth: "topEdges" },
        },
        {
          whenState: "isSelected",
          then: { color: colors.edgeSelected, size: 2, depth: "topEdges" },
        },
      ],
    },
  };
}

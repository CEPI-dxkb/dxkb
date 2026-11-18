import type { SelectionFocus } from "./selection-focus";

export const colors = {
  microbial: "#90CAF9",
  host: "#A5D6A7",
  selected: "#FFAB00",
  edge: "#555555",
  edgeExperimental: "#3F51B5",
  edgeSelected: "#FF1493",
  dim: "#8C8C8C",
  edgeExperimentalFocus: "#7986CB",
} as const;

// Low alpha keeps thousands of overlapping edges from becoming a solid fill (0x28 = 40/255, ~16%).
export const edgeAlpha = 0x28;

// Sigma blends with premultiplied alpha but its edge shader emits straight alpha, so a plain
// #rrggbbaa washes out to white; premultiply RGB ourselves. Premultiplied edges converge to the
// original hue as they stack, so deriving these from the theme `colors` keeps dense regions
// matching the legend swatches.
function premultiply(hex: string, alpha: number): string {
  const a = alpha / 255;
  const channel = (i: number) =>
    Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * a)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}${alpha.toString(16).padStart(2, "0")}`;
}

export const renderEdge = premultiply(colors.edge, edgeAlpha);
export const renderEdgeExperimental = premultiply(
  colors.edgeExperimental,
  edgeAlpha,
);

// Translucent pink (0x99 = 60%) so a hovered edge stays distinct from the opaque selected edge;
// premultiplied for the same reason as the mesh edges.
export const renderEdgeHover = premultiply(colors.edgeSelected, 0x99);

// Selection focus: while something is selected every other node/edge is recoloured to a faint
// translucent grey (still hit-testable, unlike `hidden`), and the selected nodes' edges get a
// stronger version of their own hue. A mid-grey sits between the light and dark `--graph-surface`
// themes, so the same translucent value reads as "dim" on both. Everything stays premultiplied:
// sigma blends premultiplied but its shaders emit straight alpha.
export const renderNodeDim = premultiply(colors.dim, 0x66);
export const renderEdgeDim = premultiply(colors.dim, 0x14);
export const renderEdgeFocus = premultiply(colors.dim, 0xe6);
export const renderEdgeFocusExperimental = premultiply(
  colors.edgeExperimentalFocus,
  0xe6,
);

// Reducers recolor selected nodes/edges and, while anything is selected, dim everything outside the
// selection's focus. Stacking is dim 0 < focus 1 < selected/hovered 2 and relies on the
// `zIndex: true` container setting.
export function nodeHighlightReducer<T extends object>(
  selectedIds: ReadonlySet<string>,
  focus: SelectionFocus | null = null,
) {
  return (node: string, data: T): T => {
    if (selectedIds.has(node)) {
      return {
        ...data,
        color: colors.selected,
        zIndex: 2,
        highlighted: selectedIds.size === 1,
      };
    }
    if (focus === null) return data;
    if (focus.nodes.has(node)) return { ...data, zIndex: 1 };
    return { ...data, color: renderNodeDim, label: null, zIndex: 0 };
  };
}

export function edgeHighlightReducer<
  T extends { color?: string; experimental?: boolean },
>(
  selectedIds: ReadonlySet<string>,
  hoveredId: string | null = null,
  focus: SelectionFocus | null = null,
) {
  return (edge: string, data: T): T => {
    if (selectedIds.has(edge)) {
      return { ...data, color: colors.edgeSelected, size: 2, zIndex: 2 };
    }
    if (hoveredId && edge === hoveredId) {
      return { ...data, color: renderEdgeHover, size: 2, zIndex: 2 };
    }
    if (focus === null) return data;
    if (focus.edges.has(edge)) {
      return {
        ...data,
        color: data.experimental
          ? renderEdgeFocusExperimental
          : renderEdgeFocus,
        size: 1.5,
        zIndex: 1,
      };
    }
    return { ...data, color: renderEdgeDim, zIndex: 0 };
  };
}

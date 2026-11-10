export const colors = {
  microbial: "#90CAF9",
  host: "#A5D6A7",
  selected: "#FFAB00",
  edge: "#555555",
  edgeExperimental: "#3F51B5",
  edgeSelected: "#FF1493",
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

// Reducers recolor selected nodes/edges and raise their zIndex above the mesh (relies on the
// `zIndex: true` container setting).
export function nodeHighlightReducer<T extends object>(
  selectedIds: ReadonlySet<string>,
) {
  return (node: string, data: T): T =>
    selectedIds.has(node)
      ? {
          ...data,
          color: colors.selected,
          zIndex: 1,
          highlighted: selectedIds.size === 1,
        }
      : data;
}

export function edgeHighlightReducer<T extends object>(
  selectedIds: ReadonlySet<string>,
  hoveredId: string | null = null,
) {
  return (edge: string, data: T): T => {
    if (selectedIds.has(edge)) {
      return { ...data, color: colors.edgeSelected, size: 2, zIndex: 1 };
    }
    if (hoveredId && edge === hoveredId) {
      return { ...data, color: renderEdgeHover, size: 2, zIndex: 1 };
    }
    return data;
  };
}

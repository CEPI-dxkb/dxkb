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
// Verified edges are the rarer, more trustworthy kind (about 1-19% of a Graph's edges), so they are drawn denser than the predicted
// mesh (0x99 = 153/255, 60%): at the mesh's alpha the two kinds could not be told apart on the canvas or in the legend.
export const edgeExperimentalAlpha = 0x99;

// Straight (not premultiplied) `#rrggbbaa`: Sigma 4's shaders premultiply on their own, so the
// translucent edges stack towards the theme swatch and dense regions match the legend.
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${alpha.toString(16).padStart(2, "0")}`;
}

export const edgeColor = withAlpha(colors.edge, edgeAlpha);
export const edgeExperimentalColor = withAlpha(
  colors.edgeExperimental,
  edgeExperimentalAlpha,
);

// Translucent pink (0x99 = 60%) so a hovered edge stays distinct from the opaque selected edge.
export const edgeHoverColor = withAlpha(colors.edgeSelected, 0x99);

// Selection focus: while something is selected every other node/edge is recoloured to a faint
// translucent grey (still hit-testable, unlike `hidden`), and the selected nodes' edges are drawn
// at high alpha in a lighter grey (`colors.dim`; Indigo 300 for experimental edges), both lighter
// than the mesh colours so they stay visible on dark surfaces. A mid-grey sits between the light
// and dark `--graph-surface` themes, so the same translucent value reads as "dim" on both.
export const nodeDimColor = withAlpha(colors.dim, 0x66);
export const edgeDimColor = withAlpha(colors.dim, 0x14);
export const edgeFocusColor = withAlpha(colors.dim, 0xe6);
export const edgeFocusExperimentalColor = withAlpha(
  colors.edgeExperimentalFocus,
  0xe6,
);

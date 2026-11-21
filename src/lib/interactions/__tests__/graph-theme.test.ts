import {
  colors,
  edgeAlpha,
  edgeColor,
  edgeDimColor,
  edgeExperimentalColor,
  edgeFocusColor,
  edgeFocusExperimentalColor,
  edgeHoverColor,
  nodeDimColor,
} from "../graph-theme";

function alphaByte(alpha: number): string {
  return alpha.toString(16).padStart(2, "0");
}

// Sigma 4's shaders premultiply on their own, so every render color is a straight `#rrggbbaa`: the
// theme swatch's own hue followed by the alpha byte.
describe("graph-theme render colors", () => {
  it.each([
    ["edgeColor", edgeColor, colors.edge, edgeAlpha],
    ["edgeExperimentalColor", edgeExperimentalColor, colors.edgeExperimental, edgeAlpha],
    ["edgeHoverColor", edgeHoverColor, colors.edgeSelected, 0x99],
    ["nodeDimColor", nodeDimColor, colors.dim, 0x66],
    ["edgeDimColor", edgeDimColor, colors.dim, 0x14],
    ["edgeFocusColor", edgeFocusColor, colors.dim, 0xe6],
    [
      "edgeFocusExperimentalColor",
      edgeFocusExperimentalColor,
      colors.edgeExperimentalFocus,
      0xe6,
    ],
  ] as const)("%s is its swatch's hue at straight alpha", (_name, color, swatch, alpha) => {
    expect(color).toMatch(/^#[0-9a-fA-F]{8}$/);
    expect(color.slice(0, 7)).toBe(swatch);
    expect(color.slice(7)).toBe(alphaByte(alpha));
  });

  it("keeps both interaction types at the low mesh alpha", () => {
    expect(edgeAlpha).toBe(0x28);
    expect(edgeColor.slice(7)).toBe(edgeExperimentalColor.slice(7));
  });
});

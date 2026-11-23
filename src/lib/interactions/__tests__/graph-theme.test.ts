import {
  colors,
  edgeAlpha,
  edgeColor,
  edgeDimColor,
  edgeExperimentalAlpha,
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
    [
      "edgeExperimentalColor",
      edgeExperimentalColor,
      colors.edgeExperimental,
      edgeExperimentalAlpha,
    ],
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

  it("draws predicted interactions at the low mesh alpha", () => {
    expect(edgeAlpha).toBe(0x28);
  });

  it("draws verified interactions denser than the predicted mesh, so the two can be told apart", () => {
    expect(edgeExperimentalAlpha).toBeGreaterThanOrEqual(edgeAlpha * 3);
    expect(edgeExperimentalAlpha).toBeLessThan(0xff);
    expect(edgeExperimentalColor.slice(7)).not.toBe(edgeColor.slice(7));
  });
});

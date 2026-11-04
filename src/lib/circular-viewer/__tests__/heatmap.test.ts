import { heatmapColor } from "../heatmap";

describe("heatmapColor", () => {
  it.each([
    [0.05, "#FFEBEE"],
    [0.1, "#FFEBEE"],
    [0.15, "#FFCDD2"],
    [1, "#B71C1C"],
    [2, "#B71C1C"],
    // Legacy fell through to plain "red" for exactly 0.
    [0, "#FFEBEE"],
    [-0.05, "#E8EAF6"],
    [-0.2, "#C5CAE9"],
    [-1, "#1A237E"],
  ])("colors %f of max as %s", (score, color) => {
    expect(heatmapColor(score, 1)).toBe(color);
  });

  it("reads a zero max as the lightest bucket", () => {
    expect(heatmapColor(5, 0)).toBe("#FFEBEE");
  });
});

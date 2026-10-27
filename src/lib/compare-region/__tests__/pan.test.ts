import { heldPanMatrix, panReach } from "../pan";

const plotWidth = 674;

describe("panReach", () => {
  it("draws a plot's width past either edge", () => {
    expect(panReach(plotWidth)).toBe(674);
  });
});

describe("heldPanMatrix", () => {
  const start = { scaleX: 4, translateX: -1000 };

  it("holds nothing at rest, so the layers follow the zoom", () => {
    expect(heldPanMatrix(null, start, false, plotWidth)).toBeNull();
    expect(heldPanMatrix(start, start, false, plotWidth)).toBeNull();
  });

  it("holds the matrix a drag begins at", () => {
    expect(heldPanMatrix(null, start, true, plotWidth)).toBe(start);
  });

  it("keeps holding it while what was drawn covers the plot", () => {
    for (const translateX of [-1674, -1300, -326]) {
      expect(
        heldPanMatrix(start, { scaleX: 4, translateX }, true, plotWidth),
      ).toBe(start);
    }
  });

  it("holds the zoom's matrix once a pan uses up the reach", () => {
    for (const translateX of [-1675, -325]) {
      const matrix = { scaleX: 4, translateX };
      expect(heldPanMatrix(start, matrix, true, plotWidth)).toBe(matrix);
    }
  });

  it("draws a zoom during the drag at once", () => {
    const zoomed = { scaleX: 4.8, translateX: -1000 };
    expect(heldPanMatrix(start, zoomed, true, plotWidth)).toBe(zoomed);
  });
});

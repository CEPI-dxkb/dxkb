import { placeTooltip, tooltipGap } from "../tooltip-placement";

const box = { width: 800, height: 600 };

describe("placeTooltip", () => {
  it("keeps the lower-right placement, with no transform, where it fits", () => {
    expect(placeTooltip({ x: 100, y: 80 }, box)).toEqual({
      left: 100 + tooltipGap,
      top: 80 + tooltipGap,
      maxWidth: 320,
    });
  });

  it("stays unflipped at the last pointer position that still fits", () => {
    // 800 - 12 - 320 = 468: a 320px tooltip started at 480 ends exactly on the edge.
    expect(placeTooltip({ x: 468, y: 80 }, box).transform).toBeUndefined();
    expect(placeTooltip({ x: 469, y: 80 }, box).transform).toBe(
      "translate(-100%, 0)",
    );
  });

  it("opens to the left once the right side cannot hold the tooltip", () => {
    expect(placeTooltip({ x: 790, y: 80 }, box)).toEqual({
      left: 790 - tooltipGap,
      top: 80 + tooltipGap,
      maxWidth: 320,
      transform: "translate(-100%, 0)",
    });
  });

  it("opens upward near the bottom edge", () => {
    expect(placeTooltip({ x: 100, y: 590 }, box)).toEqual({
      left: 100 + tooltipGap,
      top: 590 - tooltipGap,
      maxWidth: 320,
      transform: "translate(0, -100%)",
    });
  });

  it("flips on both axes in the bottom-right corner", () => {
    expect(placeTooltip({ x: 790, y: 590 }, box)).toEqual({
      left: 790 - tooltipGap,
      top: 590 - tooltipGap,
      maxWidth: 320,
      transform: "translate(-100%, -100%)",
    });
  });

  describe("in a box too narrow for the tooltip on either side", () => {
    const narrow = { width: 300, height: 600 };

    it("opens toward the side with more room", () => {
      expect(placeTooltip({ x: 100, y: 80 }, narrow).transform).toBeUndefined();
      expect(placeTooltip({ x: 200, y: 80 }, narrow).transform).toBe(
        "translate(-100%, 0)",
      );
    });

    it("caps the width to the room on that side, so the text wraps instead of clipping", () => {
      // Right of the pointer: 300 - 100 - 12; left of it: 200 - 12.
      expect(placeTooltip({ x: 100, y: 80 }, narrow).maxWidth).toBe(188);
      expect(placeTooltip({ x: 200, y: 80 }, narrow).maxWidth).toBe(188);
    });

    it("never narrows below what a protein id needs", () => {
      expect(
        placeTooltip({ x: 40, y: 80 }, { width: 100, height: 600 }).maxWidth,
      ).toBe(120);
    });
  });
});

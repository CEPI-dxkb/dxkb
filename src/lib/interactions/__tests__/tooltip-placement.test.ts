import { placeTooltip, tooltipGap } from "../tooltip-placement";

const box = { width: 800, height: 600 };

describe("placeTooltip", () => {
  it("keeps the lower-right placement, with no transform, where it fits", () => {
    expect(placeTooltip({ x: 100, y: 80 }, box)).toEqual({
      left: 100 + tooltipGap,
      top: 80 + tooltipGap,
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
      transform: "translate(-100%, 0)",
    });
  });

  it("opens upward near the bottom edge", () => {
    expect(placeTooltip({ x: 100, y: 590 }, box)).toEqual({
      left: 100 + tooltipGap,
      top: 590 - tooltipGap,
      transform: "translate(0, -100%)",
    });
  });

  it("flips on both axes in the bottom-right corner", () => {
    expect(placeTooltip({ x: 790, y: 590 }, box)).toEqual({
      left: 790 - tooltipGap,
      top: 590 - tooltipGap,
      transform: "translate(-100%, -100%)",
    });
  });

  it("does not flip toward the side with less room in a box too small for either", () => {
    // 300px wide: the tooltip fits on neither side, so it goes where there is more room.
    const narrow = { width: 300, height: 600 };
    expect(placeTooltip({ x: 100, y: 80 }, narrow).transform).toBeUndefined();
    expect(placeTooltip({ x: 200, y: 80 }, narrow).transform).toBe(
      "translate(-100%, 0)",
    );
  });
});

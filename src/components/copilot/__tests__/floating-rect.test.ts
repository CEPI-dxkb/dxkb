import { clampFloatingRect, resizeFloatingRect } from "../copilot-floating-window";

const viewport = { width: 1400, height: 900 };
// left 956..right 1376, top 236..bottom 876
const start = { right: 24, bottom: 24, width: 420, height: 640 };

describe("resizeFloatingRect", () => {
  it("moves only the dragged edge", () => {
    expect(resizeFloatingRect(start, "w", -100, 0, viewport)).toEqual({
      ...start,
      width: 520,
    });
    expect(resizeFloatingRect(start, "e", -50, 0, viewport)).toEqual({
      ...start,
      width: 370,
      right: 74,
    });
    expect(resizeFloatingRect(start, "n", 0, 40, viewport)).toEqual({
      ...start,
      height: 600,
    });
    expect(resizeFloatingRect(start, "s", 0, -60, viewport)).toEqual({
      ...start,
      height: 580,
      bottom: 84,
    });
  });

  it("moves both edges of a corner", () => {
    expect(resizeFloatingRect(start, "nw", -10, -20, viewport)).toEqual({
      ...start,
      width: 430,
      height: 660,
    });
    expect(resizeFloatingRect(start, "se", -30, -40, viewport)).toEqual({
      right: 54,
      bottom: 64,
      width: 390,
      height: 600,
    });
  });

  it("stops at the minimum size without moving the opposite edge", () => {
    expect(resizeFloatingRect(start, "w", 400, 0, viewport)).toEqual({
      ...start,
      width: 320,
    });
    expect(resizeFloatingRect(start, "s", 0, -500, viewport)).toEqual({
      ...start,
      height: 360,
      bottom: 304,
    });
  });

  it("stops an edge at the viewport margin", () => {
    expect(resizeFloatingRect(start, "e", 500, 0, viewport)).toEqual({
      ...start,
      width: 436,
      right: 8,
    });
    expect(resizeFloatingRect(start, "n", 0, -1000, viewport)).toEqual({
      ...start,
      height: 868,
    });
  });
});

describe("clampFloatingRect", () => {
  it("shrinks a window larger than the viewport, then keeps it on screen", () => {
    expect(
      clampFloatingRect({ right: -50, bottom: 2000, width: 2000, height: 600 }, { width: 800, height: 700 }),
    ).toEqual({ right: 8, bottom: 92, width: 784, height: 600 });
  });
});

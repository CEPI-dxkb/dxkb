import type { TransformMatrix } from "@visx/zoom";
import { visibleDomain } from "../ruler";
import {
  carryMatrix,
  formatZoomLevel,
  wheelDelta,
  zoomLimits,
  zoomSliderValue,
  zoomStep,
} from "../zoom";

function matrix(scaleX: number, translateX: number): TransformMatrix {
  return { scaleX, scaleY: 1, translateX, translateY: 0, skewX: 0, skewY: 0 };
}

describe("wheelDelta", () => {
  it("zooms 20% a notch, horizontally only", () => {
    expect(wheelDelta({ deltaY: -1 })).toEqual({ scaleX: 1.2, scaleY: 1 });
    expect(wheelDelta({ deltaY: 1 })).toEqual({ scaleX: 1 / 1.2, scaleY: 1 });
  });
});

describe("zoomLimits", () => {
  it("cannot zoom out at the whole window", () => {
    expect(zoomLimits({ scaleX: 1 })).toEqual({
      level: 1,
      maxZoom: 20,
      canZoomIn: true,
      canZoomOut: false,
    });
  });

  it("cannot zoom in at the maximum", () => {
    expect(zoomLimits({ scaleX: 20 })).toEqual(
      expect.objectContaining({ canZoomIn: false, canZoomOut: true }),
    );
  });

  it("treats a level within 1e-6 of a limit as the limit", () => {
    expect(zoomLimits({ scaleX: 1.0000001 }).canZoomOut).toBe(false);
    expect(zoomLimits({ scaleX: 19.9999999 }).canZoomIn).toBe(false);
    expect(zoomLimits({ scaleX: 1.01 }).canZoomOut).toBe(true);
  });
});

describe("zoomStep", () => {
  it("is the buttons' 1.5× step", () => {
    expect(zoomStep).toBe(1.5);
  });
});

describe("formatZoomLevel", () => {
  it.each([
    [1, "1.0×"],
    [1.5, "1.5×"],
    [2.25, "2.3×"],
    [3.375, "3.4×"],
    [7.59, "7.6×"],
    [9.94, "9.9×"],
    [9.96, "10×"],
    [11.39, "11×"],
    [17.09, "17×"],
    [20, "20×"],
  ])("shows %f as %s", (level, text) => {
    expect(formatZoomLevel(level)).toBe(text);
  });
});

describe("zoomSliderValue", () => {
  it.each([
    [1, 0],
    [1.5, 13.5],
    [2, 23.1],
    [5, 53.7],
    [10, 76.9],
    [20, 100],
  ])("puts %f at %f on a log scale", (level, value) => {
    expect(zoomSliderValue(level, 20)).toBe(value);
  });
});

describe("carryMatrix", () => {
  it("scales the pan with the plot width", () => {
    expect(carryMatrix(matrix(2, -300), 600, 500).translateX).toBe(-250);
  });

  it("keeps the zoom when the label column changes width (Comfortable to Compact at a 1440 px card)", () => {
    const carried = carryMatrix(matrix(3, -1000), 1172, 1208);
    expect(carried.scaleX).toBe(3);
    expect(carried.translateX).toBeCloseTo(-1030.7167, 4);
  });

  it("starts unpanned from a plot that had no width", () => {
    expect(carryMatrix(matrix(2, -300), 0, 500).translateX).toBe(0);
  });

  it("keeps the whole window at 1×", () => {
    expect(carryMatrix(matrix(1, 0), 674, 710)).toEqual(matrix(1, 0));
  });

  it("clamps a pan past the window's end", () => {
    expect(carryMatrix(matrix(2, -1000), 500, 400).translateX).toBe(-400);
  });

  it.each([
    [matrix(2, -300), 600, 500],
    [matrix(3, -1000), 1172, 1208],
    [matrix(5, -1234), 674, 1172],
  ])(
    "shows the same bp range after the carry (%o, %i to %i px)",
    (from, fromWidth, toWidth) => {
      const domain: [number, number] = [-5000, 5000];
      const before = visibleDomain(domain, from, fromWidth);
      const after = visibleDomain(
        domain,
        carryMatrix(from, fromWidth, toWidth),
        toWidth,
      );
      expect(after[0]).toBeCloseTo(before[0], 6);
      expect(after[1]).toBeCloseTo(before[1], 6);
    },
  );
});

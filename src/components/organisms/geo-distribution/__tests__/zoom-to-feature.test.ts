import { readFileSync } from "node:fs";
import path from "node:path";

import { geoNaturalEarth1 } from "@visx/vendor/d3-geo";
import { identityMatrix } from "@visx/zoom";

import {
  countryFitPadding,
  mapScaleMax,
  mapScaleMin,
} from "../map-constants";
import { extractFeatures, type TopologyLike } from "../topology-utils";
import {
  animateTransform,
  countryBounds,
  fitTransform,
  mainLandmassBounds,
  prefersReducedMotion,
  zoomTransformAt,
  type Bounds,
  type RingBox,
} from "../zoom-to-feature";

const viewport = { width: 900, height: 524 };
const options = { padding: 0.1, minScale: 0.6, maxScale: 32 };

function project(matrix: ReturnType<typeof fitTransform>, x: number, y: number) {
  return [
    matrix.scaleX * x + matrix.translateX,
    matrix.scaleY * y + matrix.translateY,
  ];
}

describe("fitTransform", () => {
  it("centres the box in the viewport", () => {
    const bounds: Bounds = [[100, 50], [200, 120]];
    const matrix = fitTransform(bounds, viewport, options);
    const [cx, cy] = project(matrix, 150, 85);
    expect(cx).toBeCloseTo(450);
    expect(cy).toBeCloseTo(262);
  });

  it("fits the box inside the padded viewport", () => {
    const bounds: Bounds = [[100, 50], [200, 120]];
    const matrix = fitTransform(bounds, viewport, options);
    const [x0, y0] = project(matrix, 100, 50);
    const [x1, y1] = project(matrix, 200, 120);
    expect(x0).toBeGreaterThanOrEqual(90 - 1e-6);
    expect(x1).toBeLessThanOrEqual(810 + 1e-6);
    expect(y0).toBeGreaterThanOrEqual(52.4 - 1e-6);
    expect(y1).toBeLessThanOrEqual(471.6 + 1e-6);
  });

  it("uses one uniform scale and no skew", () => {
    const matrix = fitTransform([[0, 0], [50, 10]], viewport, options);
    expect(matrix.scaleX).toBe(matrix.scaleY);
    expect(matrix.skewX).toBe(0);
    expect(matrix.skewY).toBe(0);
  });

  it("clamps a tiny box to maxScale", () => {
    const matrix = fitTransform([[10, 10], [10.2, 10.1]], viewport, options);
    expect(matrix.scaleX).toBe(32);
  });

  it("clamps a zero-size box instead of dividing by zero", () => {
    const matrix = fitTransform([[10, 10], [10, 10]], viewport, options);
    expect(Number.isFinite(matrix.scaleX)).toBe(true);
    expect(matrix.scaleX).toBe(32);
  });

  it("clamps a huge box to minScale", () => {
    const matrix = fitTransform([[-5000, -5000], [5000, 5000]], viewport, options);
    expect(matrix.scaleX).toBe(0.6);
  });
});

function ring(x0: number, y0: number, x1: number, y1: number): RingBox {
  return {
    area: (x1 - x0) * (y1 - y0),
    bounds: [[x0, y0], [x1, y1]],
  };
}

describe("mainLandmassBounds", () => {
  it("returns null for no rings", () => {
    expect(mainLandmassBounds([], () => 10)).toBeNull();
  });

  it("keeps a near ring and drops a far one", () => {
    const lead = ring(0, 0, 100, 100);
    const near = ring(105, 0, 115, 10);
    const far = ring(500, 500, 510, 510);
    expect(mainLandmassBounds([far, near, lead], () => 20)).toEqual([
      [0, 0],
      [115, 100],
    ]);
  });

  it("chains rings that are only near each other once the box has grown", () => {
    const lead = ring(0, 0, 100, 100);
    const first = ring(110, 0, 150, 40);
    const second = ring(160, 0, 180, 20);
    expect(mainLandmassBounds([lead, first, second], () => 15)).toEqual([
      [0, 0],
      [180, 100],
    ]);
  });
});

describe("countryBounds on the real 110m topology", () => {
  const countryViewport = { width: 900, height: 524 };
  const projection = geoNaturalEarth1()
    .scale(Math.min(countryViewport.width / 6.3, countryViewport.height * 0.29))
    .translate([countryViewport.width / 2, countryViewport.height / 2]);
  const topology = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "public/maps/countries-110m.json"),
      "utf8",
    ),
  ) as TopologyLike;
  const features = extractFeatures(topology, "countries");
  const byName = (name: string) => {
    const found = features.find((feature) => feature.properties.name === name);
    if (!found) throw new Error(`${name} missing from countries-110m.json`);
    return found;
  };
  const width = (bounds: Bounds) => bounds[1][0] - bounds[0][0];

  it("frames Fiji's main islands, not the antimeridian-spanning box", () => {
    const bounds = countryBounds(projection, byName("Fiji"));
    expect(bounds).not.toBeNull();
    expect(width(bounds as Bounds)).toBeLessThan(20);
  });

  it("drops Chukotka from Russia", () => {
    const bounds = countryBounds(projection, byName("Russia")) as Bounds;
    expect(bounds[0][0]).toBeGreaterThan(countryViewport.width / 2 - 200);
    expect(width(bounds)).toBeLessThan(560);
  });

  it("drops French Guiana from France", () => {
    const bounds = countryBounds(projection, byName("France")) as Bounds;
    expect(bounds[1][1]).toBeLessThan(170);
  });

  it("keeps Malaysia's two landmasses together", () => {
    const bounds = countryBounds(projection, byName("Malaysia")) as Bounds;
    expect(width(bounds)).toBeGreaterThan(30);
  });

  it("gives every country finite bounds and an in-range fit", () => {
    for (const feature of features) {
      const bounds = countryBounds(projection, feature);
      expect(bounds, feature.properties.name).not.toBeNull();
      const matrix = fitTransform(bounds as Bounds, countryViewport, {
        padding: countryFitPadding,
        minScale: mapScaleMin,
        maxScale: mapScaleMax,
      });
      expect(Number.isFinite(matrix.scaleX), feature.properties.name).toBe(true);
      expect(matrix.scaleX).toBeGreaterThanOrEqual(mapScaleMin);
      expect(matrix.scaleX).toBeLessThanOrEqual(mapScaleMax);
    }
  });
});

describe("zoomTransformAt", () => {
  const flightViewport = { width: 900, height: 524 };
  const limits = { minScale: 0.6, maxScale: 32 };
  const to = fitTransform([[100, 50], [140, 80]], flightViewport, {
    padding: 0.1,
    ...limits,
  });

  it("starts exactly at from and ends exactly at to", () => {
    const at = zoomTransformAt(identityMatrix(), to, flightViewport, limits);
    expect(at(0)).toEqual(identityMatrix());
    expect(at(1)).toEqual(to);
  });

  it("never leaves the zoom limits mid-flight", () => {
    const at = zoomTransformAt(identityMatrix(), to, flightViewport, limits);
    for (let step = 0; step <= 20; step += 1) {
      const { scaleX } = at(step / 20);
      expect(scaleX).toBeGreaterThanOrEqual(limits.minScale);
      expect(scaleX).toBeLessThanOrEqual(limits.maxScale);
    }
  });
});

describe("zoomTransformAt between two distant, fully zoomed-in views", () => {
  const flightViewport = { width: 900, height: 524 };
  // Unclamped, the zoom-out between these two views dips to about 0.94x, below this floor.
  const limits = { minScale: 1.5, maxScale: 32 };
  const fit = { padding: 0.1, ...limits };
  const from = fitTransform([[20, 20], [24, 24]], flightViewport, fit);
  const to = fitTransform([[860, 480], [864, 484]], flightViewport, fit);

  it("clamps the dip to minScale instead of leaving the zoom range", () => {
    const at = zoomTransformAt(from, to, flightViewport, limits);
    const scales = Array.from({ length: 41 }, (_, step) => at(step / 40).scaleX);
    expect(Math.min(...scales)).toBe(limits.minScale);
    expect(Math.max(...scales)).toBeLessThanOrEqual(limits.maxScale);
  });
});

describe("animateTransform", () => {
  const flightViewport = { width: 900, height: 524 };
  const limits = { minScale: 0.6, maxScale: 32 };
  const to = fitTransform([[100, 50], [140, 80]], flightViewport, {
    padding: 0.1,
    ...limits,
  });

  function fakeClock() {
    let time = 0;
    let pending: ((time: number) => void) | null = null;
    return {
      now: () => time,
      requestFrame: (callback: (time: number) => void) => {
        pending = callback;
        return 1;
      },
      cancelFrame: () => {
        pending = null;
      },
      advance(ms: number) {
        time += ms;
        const callback = pending;
        pending = null;
        callback?.(time);
      },
    };
  }

  it("applies the target at once when the duration is 0", () => {
    const apply = vi.fn();
    animateTransform({
      from: identityMatrix(),
      to,
      viewport: flightViewport,
      limits,
      durationMs: 0,
      apply,
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(to);
  });

  it("ends on the exact target after the duration", () => {
    const clock = fakeClock();
    const apply = vi.fn();
    animateTransform({
      from: identityMatrix(),
      to,
      viewport: flightViewport,
      limits,
      durationMs: 600,
      apply,
      ...clock,
    });
    clock.advance(300);
    clock.advance(400);
    expect(apply).toHaveBeenLastCalledWith(to);
    const callsAtEnd = apply.mock.calls.length;
    clock.advance(100);
    expect(apply).toHaveBeenCalledTimes(callsAtEnd);
  });

  it("does not schedule another frame when apply cancels the animation", () => {
    const clock = fakeClock();
    const requestFrame = vi.fn(clock.requestFrame);
    let cancel: () => void = () => undefined;
    const apply = vi.fn(() => {
      cancel();
    });
    cancel = animateTransform({
      from: identityMatrix(),
      to,
      viewport: flightViewport,
      limits,
      durationMs: 600,
      apply,
      ...clock,
      requestFrame,
    });
    expect(requestFrame).toHaveBeenCalledTimes(1);
    clock.advance(100);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it("stops applying frames once cancelled", () => {
    const clock = fakeClock();
    const apply = vi.fn();
    const cancel = animateTransform({
      from: identityMatrix(),
      to,
      viewport: flightViewport,
      limits,
      durationMs: 600,
      apply,
      ...clock,
    });
    clock.advance(100);
    const callsBeforeCancel = apply.mock.calls.length;
    expect(callsBeforeCancel).toBeGreaterThan(0);
    cancel();
    clock.advance(100);
    expect(apply).toHaveBeenCalledTimes(callsBeforeCancel);
  });
});

describe("prefersReducedMotion", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("is false when the browser has no matchMedia", () => {
    Reflect.deleteProperty(window, "matchMedia");
    expect(prefersReducedMotion()).toBe(false);
  });

  it("follows the prefers-reduced-motion media query", () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
    }));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMedia,
    });
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });
});

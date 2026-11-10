import { scaleBand } from "@visx/scale";
import type { MouseEvent, RefObject } from "react";

import { nearestBandIndex } from "../use-svg-band-pointer";
import { chartMarginLeft, chartWidth, yearInnerWidth } from "../chart-dimensions";

function makeEvent(clientX: number): MouseEvent<SVGElement> {
  return { clientX } as MouseEvent<SVGElement>;
}

function svgRef(width: number): RefObject<SVGSVGElement | null> {
  const node = {
    getBoundingClientRect: () =>
      ({ left: 0, width } as DOMRect),
  } as unknown as SVGSVGElement;
  return { current: node };
}

describe("nearestBandIndex", () => {
  const years = [2020, 2021, 2022, 2023];
  const xScale = scaleBand<number>({
    domain: years,
    range: [0, yearInnerWidth],
    padding: 0.25,
  });
  const halfBand = xScale.bandwidth() / 2;
  const centers = years.map((y) => (xScale(y) ?? 0) + halfBand);

  it("returns the index of the band whose center is closest to the cursor", () => {
    for (let idx = 0; idx < years.length; idx++) {
      const clientX = centers[idx] + chartMarginLeft;
      expect(
        nearestBandIndex(makeEvent(clientX), svgRef(chartWidth), xScale, years),
      ).toBe(idx);
    }
  });

  it("accounts for paddingOuter — the first band is NOT at x=0", () => {
    // The first band's center sits at the paddingOuter offset, so nearestBandIndex
    // must use band centers, not Math.round(x/step).
    const firstCenter = centers[0];
    expect(firstCenter).toBeGreaterThan(0);
    expect(
      nearestBandIndex(makeEvent(chartMarginLeft), svgRef(chartWidth), xScale, years),
    ).toBe(0);
  });

  it("returns null when data is empty", () => {
    expect(
      nearestBandIndex(makeEvent(50), svgRef(chartWidth), xScale, [] as number[]),
    ).toBeNull();
  });

  it("scales mouseX by the viewport-to-SVG ratio", () => {
    const renderedWidth = chartWidth / 2;
    expect(
      nearestBandIndex(
        makeEvent(chartMarginLeft / 2),
        svgRef(renderedWidth),
        xScale,
        years,
      ),
    ).toBe(0);
  });
});

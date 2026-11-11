import type { ScaleBand } from "@visx/vendor/d3-scale";
import type { MouseEvent, RefObject } from "react";

import { chartMarginLeft, chartWidth } from "./chart-dimensions";

/** Nearest band index for a pointer over the overlay; uses band centers, not Math.round(x/step), so paddingOuter does not skew it. */
export function nearestBandIndex<T extends { toString(): string }>(
  event: MouseEvent<SVGElement>,
  svgRef: RefObject<SVGSVGElement | null>,
  xScale: ScaleBand<T>,
  data: readonly T[],
  marginLeft: number = chartMarginLeft,
  viewBoxWidth: number = chartWidth,
): number | null {
  const svgRect = svgRef.current?.getBoundingClientRect();
  const scaleX = svgRect && svgRect.width > 0 ? viewBoxWidth / svgRect.width : 1;
  const mouseX = svgRect
    ? (event.clientX - svgRect.left) * scaleX - marginLeft
    : event.clientX - marginLeft;
  const halfBand = xScale.bandwidth() / 2;
  let closestIdx = -1;
  let closestDist = Infinity;
  data.forEach((datum, idx) => {
    const center = (xScale(datum) ?? 0) + halfBand;
    const dist = Math.abs(mouseX - center);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = idx;
    }
  });
  return closestIdx >= 0 ? closestIdx : null;
}

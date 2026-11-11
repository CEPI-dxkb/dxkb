/**
 * A track's marks are joined into one `d` (one per color for a heatmap): a CDS
 * track holds thousands of features, and one element each made every repaint
 * and hover walk them all.
 */
import { arc, radialLine } from "@visx/shape";
import { curveLinear } from "@visx/vendor/d3-shape";

export interface AngleSpan {
  startAngle: number;
  endAngle: number;
}

export interface RadialSpan extends AngleSpan {
  innerRadius: number;
  outerRadius: number;
}

export interface RadialPoint {
  angle: number;
  radius: number;
}

export interface ScoreScale {
  min: number;
  max: number;
}

const sector = arc<RadialSpan>({
  innerRadius: (span) => span.innerRadius,
  outerRadius: (span) => span.outerRadius,
  startAngle: (span) => span.startAngle,
  endAngle: (span) => span.endAngle,
});

export function radialSectorsPath(spans: Iterable<RadialSpan>): string {
  let path = "";
  for (const span of spans) path += sector(span) ?? "";
  return path;
}

export function sectorsPath(
  spans: Iterable<AngleSpan>,
  innerRadius: number,
  outerRadius: number,
): string {
  let path = "";
  for (const span of spans) {
    path += sector({ ...span, innerRadius, outerRadius }) ?? "";
  }
  return path;
}

const polyline = radialLine<RadialPoint>({
  angle: (point) => point.angle,
  radius: (point) => point.radius,
  curve: curveLinear,
});

export function polylinesPath(lines: Iterable<readonly RadialPoint[]>): string {
  let path = "";
  for (const line of lines) {
    if (line.length > 1) path += polyline([...line]) ?? "";
  }
  return path;
}

export function scoreRadius(
  score: number,
  scale: ScoreScale,
  innerRadius: number,
  outerRadius: number,
): number {
  const span = scale.max - scale.min;
  if (!(span > 0)) return innerRadius;
  const clamped = Math.min(Math.max(score, scale.min), scale.max);
  return innerRadius + ((clamped - scale.min) / span) * (outerRadius - innerRadius);
}

export function baselineRadius(
  scale: ScoreScale,
  innerRadius: number,
  outerRadius: number,
): number {
  return scoreRadius(0, scale, innerRadius, outerRadius);
}

export function gridRadii(innerRadius: number, outerRadius: number): number[] {
  const width = outerRadius - innerRadius;
  return [innerRadius + width / 4, innerRadius + width / 2, innerRadius + (3 * width) / 4];
}

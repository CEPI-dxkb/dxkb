/**
 * The Compare Region Viewer's x axis under the zoom: bp offsets (from each
 * row's pinned gene) to track pixels, the offsets the track shows, the ruler's
 * ticks and the focus line's position. Zooming only changes the x scale, so
 * these take the layout's domain and the zoom's horizontal matrix.
 */
import { scaleLinear } from "@visx/scale";
import { formatBp } from "./genome-labels";

/** The horizontal part of `@visx/zoom`'s transform matrix. */
export interface TrackMatrix {
  scaleX: number;
  translateX: number;
}

/** Offset (bp) to track pixels under the zoom. */
export function trackScale(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): (offset: number) => number {
  const [d0, d1] = domain;
  const k = (plotWidth * matrix.scaleX) / (d1 - d0);
  return (offset: number) => matrix.translateX + (offset - d0) * k;
}

/** The offsets (bp) the track shows under the zoom. */
export function visibleDomain(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): [number, number] {
  const [d0, d1] = domain;
  const k = (plotWidth * matrix.scaleX) / (d1 - d0);
  return [
    d0 + (0 - matrix.translateX) / k,
    d0 + (plotWidth - matrix.translateX) / k,
  ];
}

export interface RulerTick {
  /** bp from the focus gene. */
  offset: number;
  x: number;
  label: string;
}

/** "+2 kb", "−1.5 kb" (a true minus sign); under half a kilobase a step, whole bases ("+250 bp"). */
function formatOffset(offset: number, step: number): string {
  if (Math.abs(offset) < 1e-6) return "0";
  const sign = offset > 0 ? "+" : "−";
  const size = Math.abs(offset);
  if (step < 500) return `${sign}${formatBp(Math.round(size))} bp`;
  return `${sign}${(size / 1000).toFixed(step >= 1000 ? 0 : 1)} kb`;
}

/**
 * Major ticks (labelled, relative to the focus gene; about one per 110 px,
 * at least two) and minor ticks at a fifth of their step (at most 400), under
 * the zoom.
 */
export function rulerTicks(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): { major: RulerTick[]; minor: number[] } {
  const visible = visibleDomain(domain, matrix, plotWidth);
  const x = trackScale(domain, matrix, plotWidth);
  const count = Math.max(2, Math.floor(plotWidth / 110));
  const values = scaleLinear<number>({ domain: visible }).ticks(count);
  const step = values.length > 1 ? values[1] - values[0] : 1000;
  const major = values.map((offset) => ({
    offset,
    x: x(offset),
    label: formatOffset(offset, step),
  }));
  const minorStep = step / 5;
  const minor: number[] = [];
  const first = Math.ceil(visible[0] / minorStep);
  const last = Math.floor(visible[1] / minorStep);
  for (let index = first; index <= last && minor.length < 400; index += 1) {
    if (index % 5 !== 0) minor.push(x(index * minorStep));
  }
  return { major, minor };
}

/** The focus line's x: offset 0, the point every row is aligned on. */
export function focusLineX(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): number {
  return trackScale(domain, matrix, plotWidth)(0);
}

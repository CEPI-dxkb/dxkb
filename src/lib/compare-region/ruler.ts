import { scaleLinear } from "@visx/scale";
import { formatBp } from "./genome-labels";

export interface TrackMatrix {
  scaleX: number;
  translateX: number;
}

export function trackScale(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): (offset: number) => number {
  const [d0, d1] = domain;
  const k = (plotWidth * matrix.scaleX) / (d1 - d0);
  return (offset: number) => matrix.translateX + (offset - d0) * k;
}

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
  offset: number;
  x: number;
  label: string;
}

function formatOffset(offset: number, step: number): string {
  if (Math.abs(offset) < 1e-6) return "0";
  const sign = offset > 0 ? "+" : "−";
  const size = Math.abs(offset);
  if (step < 500) return `${sign}${formatBp(Math.round(size))} bp`;
  return `${sign}${(size / 1000).toFixed(step >= 1000 ? 0 : 1)} kb`;
}

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

export function focusLineX(
  domain: [number, number],
  matrix: TrackMatrix,
  plotWidth: number,
): number {
  return trackScale(domain, matrix, plotWidth)(0);
}

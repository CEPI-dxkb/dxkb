import type { GenomeLayout } from "./layout";

export type TickSize = "minor" | "medium" | "major";

export interface Tick {
  angle: number;
  size: TickSize;
  label?: string;
}

export function tickUnit(totalLength: number, longest: number): number {
  if (totalLength > 5_000_000 && longest > 1_000_000) return 100_000;
  if (totalLength < 300_000) return 1_000;
  return 10_000;
}

export function positionTicks(layout: GenomeLayout): Tick[] {
  const longest = layout.contigs.reduce((max, contig) => Math.max(max, contig.length), 0);
  const unit = tickUnit(layout.totalLength, longest);
  const unitMbp = unit / 1_000_000;
  const decimals = Math.max(0, Math.round(Math.log10(1 / unitMbp)) - 1);
  const ticks: Tick[] = [];
  for (const contig of layout.contigs) {
    ticks.push({ angle: contig.startAngle, size: "medium" });
    const count = Math.round(contig.length / unit);
    for (let index = 1; index < count - 1; index += 1) {
      const angle = contig.startAngle + index * unit * layout.radiansPerBase;
      if (index % 10 === 0) {
        ticks.push({ angle, size: "major", label: (index * unitMbp).toFixed(decimals) });
      } else {
        ticks.push({ angle, size: index % 5 === 0 ? "medium" : "minor" });
      }
    }
  }
  return ticks;
}

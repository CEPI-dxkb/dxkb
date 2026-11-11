import type { CompareRegionFeature } from "./contract";
import { rulerHeight, type DensitySpec } from "./density";
import type { CompareRegionLayout, PlacedFeature } from "./layout";

export type GlyphKind = "gene" | "orphan" | "blast" | "pseudo" | "other";

export function glyphKind(feature: CompareRegionFeature): GlyphKind {
  if (feature.type === "peg" || feature.type === "domain_hit") {
    return feature.family === null ? "orphan" : "gene";
  }
  if (feature.type === "blast") return "blast";
  if (feature.type === "pseudogene") return "pseudo";
  return "other";
}

export interface RowFrame {
  laneTops: number[];
  top: number;
  bottom: number;
  center: number;
  slotTop: number;
  slotBottom: number;
}

export interface FigureFrame {
  rows: RowFrame[];
  dividers: number[];
  height: number;
}

export function measureFigure(
  layout: CompareRegionLayout,
  spec: DensitySpec,
): FigureFrame {
  const rows: RowFrame[] = [];
  const dividers: number[] = [];
  let top = rulerHeight + spec.firstRowGap;
  for (const placed of layout.rows) {
    const laneTops: number[] = [];
    let y = top;
    for (let lane = 0; lane < placed.laneCount; lane += 1) {
      const inLane = placed.features.filter((item) => item.lane === lane);
      const thin =
        lane > 0 && inLane.every((item) => glyphKind(item.feature) === "blast");
      if (lane > 0) y += thin ? spec.blastGap : spec.laneGap;
      laneTops.push(y);
      y +=
        lane === 0
          ? spec.geneHeight
          : thin
            ? spec.blastHeight
            : spec.overlapHeight;
    }
    rows.push({
      laneTops,
      top,
      bottom: y,
      center: top + spec.geneHeight / 2,
      slotTop: 0,
      slotBottom: 0,
    });
    top = y + spec.rowGap;
  }
  const height = (rows.at(-1)?.bottom ?? rulerHeight) + spec.bottomPad;
  rows.forEach((row, index) => {
    const previous = rows.at(index - 1);
    const next = rows.at(index + 1);
    row.slotTop =
      index === 0 || !previous
        ? rulerHeight
        : previous.bottom + spec.rowGap / 2;
    row.slotBottom = next ? row.bottom + spec.rowGap / 2 : height;
    if (next) dividers.push(row.slotBottom);
  });
  return { rows, dividers, height };
}

export function glyphBox(
  spec: DensitySpec,
  frame: RowFrame,
  item: PlacedFeature,
): { top: number; bottom: number } {
  const laneTop = frame.laneTops.at(item.lane) ?? frame.top;
  const tall = item.lane === 0 ? spec.geneHeight : spec.overlapHeight;
  const inset = item.lane === 0 ? spec.otherInset : spec.overlapOtherInset;
  switch (glyphKind(item.feature)) {
    case "blast":
      return { top: laneTop, bottom: laneTop + spec.blastHeight };
    case "pseudo":
      return { top: laneTop + 1, bottom: laneTop + tall - 1 };
    case "other":
      return { top: laneTop + inset, bottom: laneTop + tall - inset };
    default:
      return { top: laneTop, bottom: laneTop + tall };
  }
}

export function rowAt(frame: FigureFrame, y: number): number | null {
  const index = frame.rows.findIndex(
    (row) => y >= row.slotTop && y < row.slotBottom,
  );
  return index === -1 ? null : index;
}

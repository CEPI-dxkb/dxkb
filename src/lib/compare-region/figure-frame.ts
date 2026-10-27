/**
 * The Compare Region Viewer figure's vertical frame: each row's lanes, the
 * slot it owns between dividers, and every glyph's vertical extent, as pure
 * functions of the layout and a density. Horizontal positions come from the
 * zoom (`ruler.ts`); a layout is measured once per answer and density.
 */
import type { CompareRegionFeature } from "./contract";
import { rulerHeight, type DensitySpec } from "./density";
import type { CompareRegionLayout, PlacedFeature } from "./layout";

export type GlyphKind = "gene" | "orphan" | "blast" | "pseudo" | "other";

/**
 * Genes (`peg`, `domain_hit`) are arrows, an orphan being a gene in no
 * family; BLAST hits are pills, pseudogenes dashed arrows, and anything else
 * (tRNA, repeats, assembly gaps) a rounded bar. The split is legacy BV-BRC's.
 */
export function glyphKind(feature: CompareRegionFeature): GlyphKind {
  if (feature.type === "peg" || feature.type === "domain_hit") {
    return feature.family === null ? "orphan" : "gene";
  }
  if (feature.type === "blast") return "blast";
  if (feature.type === "pseudogene") return "pseudo";
  return "other";
}

export interface RowFrame {
  /** Top of each lane. */
  laneTops: number[];
  /** Top of lane 0 and bottom of the lowest lane. */
  top: number;
  bottom: number;
  /** Lane 0's middle: where the contig baseline runs (the label centers on the slot instead). */
  center: number;
  /** The row's slot, divider to divider (the ruler above row 1, the figure's end below the last). */
  slotTop: number;
  slotBottom: number;
}

export interface FigureFrame {
  rows: RowFrame[];
  /** y of the hairline between each pair of rows. */
  dividers: number[];
  height: number;
}

/**
 * Each row's lanes, slot and center, and the dividers between rows. Lane 0
 * is a gene tall, lanes holding only BLAST hits are a thin bar, and the other
 * lanes are `overlapHeight` (in Comfortable, a gene tall too).
 */
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

/** A glyph's vertical extent within its lane. */
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

/** The row whose slot holds `y` (svg px), or null above the first and below the last. */
export function rowAt(frame: FigureFrame, y: number): number | null {
  const index = frame.rows.findIndex(
    (row) => y >= row.slotTop && y < row.slotBottom,
  );
  return index === -1 ? null : index;
}

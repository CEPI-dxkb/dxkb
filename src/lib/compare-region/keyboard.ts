/**
 * The Compare Region Viewer's keyboard, as pure functions of the layout:
 * which gene an arrow key moves to, which gene holds the figure's one tab
 * stop, what each gene and row is called to assistive technology, and how far
 * the zoom and the scroller move to bring a focused gene into view.
 *
 * Genes are ordered as they stand on screen, left to right, not in the
 * service's order (a mirrored row sends them right to left).
 */
import type { TransformMatrix } from "@visx/zoom";
import type { CompareRegionFeature } from "./contract";
import type { FeatureRef } from "./families";
import { glyphKind } from "./figure-frame";
import { noProduct, rowTagText } from "./genome-labels";
import {
  constrainToTrack,
  type CompareRegionLayout,
  type PlacedFeature,
  type PlacedRow,
} from "./layout";
import { trackScale } from "./ruler";

/** Where a key moves the focus: along the row, to its ends, or to the row above or below. */
export type FeatureStep = "previous" | "next" | "first" | "last" | "up" | "down";

/** The keys that move the focus between genes, and where each goes. */
export const featureStepKeys: Readonly<Partial<Record<string, FeatureStep>>> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  Home: "first",
  End: "last",
  ArrowUp: "up",
  ArrowDown: "down",
};

/** How far inside the plot (and the scroller) a revealed gene comes to rest, px. */
export const revealMargin = 8;

function middleOf(item: PlacedFeature): number {
  return (item.from + item.to) / 2;
}

/** A row's feature indices as they stand on screen: left to right by their middle, the upper lane first. */
export function screenOrder(placed: PlacedRow): number[] {
  return placed.features
    .map((item, index) => ({ index, middle: middleOf(item), lane: item.lane }))
    .sort((a, b) => a.middle - b.middle || a.lane - b.lane)
    .map(({ index }) => index);
}

/** The feature of `placed` nearest `middle` (bp offset), the upper lane winning a tie. */
function nearestIn(placed: PlacedRow, middle: number): number {
  let best = 0;
  for (let index = 1; index < placed.features.length; index += 1) {
    const item = placed.features[index];
    const bestItem = placed.features[best];
    const distance = Math.abs(middleOf(item) - middle);
    const bestDistance = Math.abs(middleOf(bestItem) - middle);
    if (
      distance < bestDistance ||
      (distance === bestDistance && item.lane < bestItem.lane)
    ) {
      best = index;
    }
  }
  return best;
}

/**
 * The gene `step` moves the focus to from `at`: the one beside it in its row,
 * the row's first or last, or the one nearest it in the next row up or down
 * that has any (rows are aligned on their pinned gene, so that is usually its
 * homolog). Null where there is none to move to.
 */
export function stepFeature(
  layout: CompareRegionLayout,
  at: FeatureRef,
  step: FeatureStep,
): FeatureRef | null {
  const placed = layout.rows.at(at.rowIndex);
  const item = placed?.features.at(at.featureIndex);
  if (!placed || !item) return null;
  if (step === "up" || step === "down") {
    const direction = step === "up" ? -1 : 1;
    for (
      let rowIndex = at.rowIndex + direction;
      rowIndex >= 0 && rowIndex < layout.rows.length;
      rowIndex += direction
    ) {
      const next = layout.rows[rowIndex];
      if (next.features.length === 0) continue;
      return { rowIndex, featureIndex: nearestIn(next, middleOf(item)) };
    }
    return null;
  }
  const order = screenOrder(placed);
  const position = order.indexOf(at.featureIndex);
  const targetPosition =
    step === "first"
      ? 0
      : step === "last"
        ? order.length - 1
        : position + (step === "next" ? 1 : -1);
  const target = targetPosition < 0 ? undefined : order.at(targetPosition);
  if (target === undefined || target === at.featureIndex) return null;
  return { rowIndex: at.rowIndex, featureIndex: target };
}

/**
 * Where the figure's tab stop rests before any gene has been focused: the
 * focus gene (the first row's pinned gene), else the first gene on screen in
 * the first row that has any. Null for a figure with no features.
 */
export function defaultTabStop(layout: CompareRegionLayout): FeatureRef | null {
  const first = layout.rows.at(0);
  const pinned =
    first?.features.findIndex(
      (item) => item.feature.fid === first.row.pinnedFid,
    ) ?? -1;
  if (pinned !== -1) return { rowIndex: 0, featureIndex: pinned };
  const rowIndex = layout.rows.findIndex((row) => row.features.length > 0);
  if (rowIndex === -1) return null;
  return { rowIndex, featureIndex: screenOrder(layout.rows[rowIndex])[0] };
}

/** What a kind of feature is called before its product; genes are called by their product alone. */
const kindNames = { blast: "BLAST hit", pseudo: "Pseudogene" } as const;

/**
 * A feature's accessible name: its product, then its ID, after its kind when
 * it is not a gene ("BLAST hit: …", "tRNA: …").
 */
export function featureName(feature: CompareRegionFeature): string {
  const kind = glyphKind(feature);
  const name = `${feature.product || noProduct}, ${feature.fid}`;
  if (kind === "blast" || kind === "pseudo") {
    return `${kindNames[kind]}: ${name}`;
  }
  return kind === "other" ? `${feature.type}: ${name}` : name;
}

/** A row's accessible name: its number tag, as the label column shows it, and its genome. */
export function rowName(rowIndex: number, genomeName: string): string {
  return `Genome ${rowTagText(rowIndex)}: ${genomeName}`;
}

/**
 * The zoom matrix that brings `item` into the plot, `revealMargin` px inside
 * its edges: panned the least that does, through `constrainToTrack` (so never
 * past the window's ends), or `matrix` itself when it is already in view. A
 * gene wider than the plot comes to rest at its start.
 */
export function revealMatrix(
  domain: [number, number],
  matrix: TransformMatrix,
  plotWidth: number,
  item: PlacedFeature,
): TransformMatrix {
  const x = trackScale(domain, matrix, plotWidth);
  const left = Math.min(x(item.from), x(item.to));
  const right = Math.max(x(item.from), x(item.to));
  const room = plotWidth - 2 * revealMargin;
  let shift = 0;
  if (left < revealMargin || right - left > room) shift = revealMargin - left;
  else if (right > plotWidth - revealMargin) {
    shift = plotWidth - revealMargin - right;
  }
  if (shift === 0) return matrix;
  return constrainToTrack(
    { ...matrix, translateX: matrix.translateX + shift },
    matrix,
    plotWidth,
  );
}

/** A box, px, in the scroller's content. */
export interface RevealBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The scroll position that brings `box` into the scroller's view, which
 * `view` describes (its scroll position and client size): moved the least
 * that does, `revealMargin` px inside it, and clear of what stays stuck over
 * its start (`inset`: the label column on the left, the ruler on top). A box
 * larger than the view comes to rest at its start.
 */
export function revealScroll(
  view: { left: number; top: number; width: number; height: number },
  box: RevealBox,
  inset: { left: number; top: number },
): { left: number; top: number } {
  const along = (
    scroll: number,
    size: number,
    stuck: number,
    start: number,
    end: number,
  ) => {
    // The furthest the view can scroll with the start in view, and the
    // least it can with the end in view.
    const latest = start - revealMargin - stuck;
    const earliest = end + revealMargin - size;
    if (scroll > latest) return Math.max(0, latest);
    if (scroll < earliest) return Math.max(0, Math.min(earliest, latest));
    return scroll;
  };
  return {
    left: along(view.left, view.width, inset.left, box.left, box.right),
    top: along(view.top, view.height, inset.top, box.top, box.bottom),
  };
}

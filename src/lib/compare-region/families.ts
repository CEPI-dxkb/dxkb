/**
 * Gene families across the Compare Region Viewer's rows: which features share
 * a family, how many genomes each family reaches, and the ribbons that join
 * same-family genes in adjacent rows. With the layout, frame and density they
 * make the `ChartModel` every figure layer draws from, built once per answer
 * and density.
 */
import type { CompareRegionFeature, CompareRegionRow } from "./contract";
import type { DensitySpec } from "./density";
import { measureFigure, type FigureFrame } from "./figure-frame";
import {
  layoutCompareRegion,
  type CompareRegionLayout,
  type PlacedFeature,
} from "./layout";

/** A feature, by its row's and its own index in the layout. */
export interface FeatureRef {
  rowIndex: number;
  featureIndex: number;
}

export interface ResolvedFeature {
  row: CompareRegionRow;
  feature: CompareRegionFeature;
}

export function resolveFeature(
  layout: CompareRegionLayout,
  ref: FeatureRef | null | undefined,
): ResolvedFeature | null {
  if (!ref) return null;
  const placed = layout.rows.at(ref.rowIndex);
  const item = placed?.features.at(ref.featureIndex);
  return placed && item ? { row: placed.row, feature: item.feature } : null;
}

/** Two same-family genes in adjacent rows (or, for a bridge, the nearest rows that have the family). */
export interface Ribbon {
  family: number;
  upper: FeatureRef;
  lower: FeatureRef;
}

export interface FamilyIndex {
  /** Every feature of a family, over all rows. */
  members: Map<number, FeatureRef[]>;
  /** How many rows (genomes) a family appears in. */
  rowCount: Map<number, number>;
  /** Ribbons, all (the focus family's last) and by family. */
  ribbons: Ribbon[];
  ribbonsByFamily: Map<number, Ribbon[]>;
}

function centerOf(item: PlacedFeature): number {
  return (item.from + item.to) / 2;
}

/**
 * Ribbons join every same-family pair across each gap. A family with many
 * copies (transposases) in either row of a gap links each upper copy to its
 * nearest lower one instead, so a gap never holds more ribbons than genes.
 */
export function indexFamilies(layout: CompareRegionLayout): FamilyIndex {
  const members = new Map<number, FeatureRef[]>();
  const rowSets = new Map<number, Set<number>>();
  layout.rows.forEach((placed, rowIndex) => {
    placed.features.forEach((item, featureIndex) => {
      const family = item.feature.family;
      if (family === null) return;
      const list = members.get(family) ?? [];
      list.push({ rowIndex, featureIndex });
      members.set(family, list);
      const rowsWith = rowSets.get(family) ?? new Set<number>();
      rowsWith.add(rowIndex);
      rowSets.set(family, rowsWith);
    });
  });
  const rowCount = new Map(
    [...rowSets].map(([family, set]) => [family, set.size]),
  );

  const ribbons: Ribbon[] = [];
  for (let rowIndex = 0; rowIndex + 1 < layout.rows.length; rowIndex += 1) {
    const upper = layout.rows[rowIndex];
    const lower = layout.rows[rowIndex + 1];
    const upperCopies = new Map<number, number>();
    for (const item of upper.features) {
      const family = item.feature.family;
      if (family !== null) {
        upperCopies.set(family, (upperCopies.get(family) ?? 0) + 1);
      }
    }
    const lowerByFamily = new Map<number, number[]>();
    lower.features.forEach((item, featureIndex) => {
      const family = item.feature.family;
      if (family === null) return;
      lowerByFamily.set(family, [
        ...(lowerByFamily.get(family) ?? []),
        featureIndex,
      ]);
    });
    upper.features.forEach((item, featureIndex) => {
      const family = item.feature.family;
      if (family === null) return;
      const matches = lowerByFamily.get(family);
      if (!matches) return;
      let targets = matches;
      if (matches.length > 2 || (upperCopies.get(family) ?? 0) > 2) {
        const nearest = matches.reduce((best, candidate) =>
          Math.abs(centerOf(lower.features[candidate]) - centerOf(item)) <
          Math.abs(centerOf(lower.features[best]) - centerOf(item))
            ? candidate
            : best,
        );
        targets = [nearest];
      }
      for (const target of targets) {
        ribbons.push({
          family,
          upper: { rowIndex, featureIndex },
          lower: { rowIndex: rowIndex + 1, featureIndex: target },
        });
      }
    });
  }
  // The focus family last, so its orange spine draws over the others.
  ribbons.sort((a, b) => Number(a.family === 1) - Number(b.family === 1));
  const ribbonsByFamily = new Map<number, Ribbon[]>();
  for (const ribbon of ribbons) {
    ribbonsByFamily.set(ribbon.family, [
      ...(ribbonsByFamily.get(ribbon.family) ?? []),
      ribbon,
    ]);
  }
  return { members, rowCount, ribbons, ribbonsByFamily };
}

/**
 * For the family trace: ribbons that bridge the genomes lacking `family`,
 * from each row that has it to the next row down that has it again (nearest
 * members), so the family's path reads through the whole figure.
 */
export function bridgeRibbons(
  layout: CompareRegionLayout,
  families: FamilyIndex,
  family: number,
): Ribbon[] {
  const byRow = new Map<number, FeatureRef[]>();
  for (const ref of families.members.get(family) ?? []) {
    byRow.set(ref.rowIndex, [...(byRow.get(ref.rowIndex) ?? []), ref]);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const bridges: Ribbon[] = [];
  const center = (ref: FeatureRef) =>
    centerOf(layout.rows[ref.rowIndex].features[ref.featureIndex]);
  rows.forEach((rowIndex, index) => {
    const next = rows.at(index + 1);
    if (next === undefined || next === rowIndex + 1) return;
    let best: Ribbon | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const upper of byRow.get(rowIndex) ?? []) {
      for (const lower of byRow.get(next) ?? []) {
        const distance = Math.abs(center(upper) - center(lower));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { family, upper, lower };
        }
      }
    }
    if (best) bridges.push(best);
  });
  return bridges;
}

/** A family seen in one genome only: drawn faded, so conserved families carry the figure. Never the focus family. */
export function isLoner(
  families: FamilyIndex,
  feature: CompareRegionFeature,
): boolean {
  const family = feature.family;
  return (
    family !== null && family !== 1 && (families.rowCount.get(family) ?? 0) < 2
  );
}

/** "in 3 of 10 genomes"; null for a feature with no family. */
export function familyReach(
  families: FamilyIndex,
  feature: CompareRegionFeature,
  rowTotal: number,
): string | null {
  if (feature.family === null) return null;
  const count = families.rowCount.get(feature.family) ?? 1;
  return `in ${String(count)} of ${String(rowTotal)} genomes`;
}

/** Everything the figure draws from, computed once per answer and density. */
export interface ChartModel {
  layout: CompareRegionLayout;
  frame: FigureFrame;
  families: FamilyIndex;
  spec: DensitySpec;
}

export function buildChartModel(
  rows: readonly CompareRegionRow[],
  spec: DensitySpec,
): ChartModel {
  const layout = layoutCompareRegion(rows);
  return {
    layout,
    frame: measureFigure(layout, spec),
    families: indexFamilies(layout),
    spec,
  };
}

/** Whether `a` and `b` are the same gene (neither missing). */
export function isSameFeature(
  a: FeatureRef | null | undefined,
  b: FeatureRef | null | undefined,
): boolean {
  return (
    !!a && !!b && a.rowIndex === b.rowIndex && a.featureIndex === b.featureIndex
  );
}

/** The members of the focus gene's family (the hovered, else the pinned, gene); just the gene when it has none. */
export function focusMembers(
  model: ChartModel,
  focus: FeatureRef | undefined,
): FeatureRef[] {
  const target = resolveFeature(model.layout, focus);
  if (!target || !focus) return [];
  const family = target.feature.family;
  return family === null
    ? [focus]
    : (model.families.members.get(family) ?? [focus]);
}

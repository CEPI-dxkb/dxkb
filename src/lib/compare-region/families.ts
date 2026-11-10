import type { CompareRegionFeature, CompareRegionRow } from "./contract";
import type { DensitySpec } from "./density";
import { measureFigure, type FigureFrame } from "./figure-frame";
import {
  layoutCompareRegion,
  type CompareRegionLayout,
  type PlacedFeature,
} from "./layout";

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

export interface Ribbon {
  family: number;
  upper: FeatureRef;
  lower: FeatureRef;
}

export interface FamilyIndex {
  members: Map<number, FeatureRef[]>;
  rowCount: Map<number, number>;
  ribbons: Ribbon[];
  ribbonsByFamily: Map<number, Ribbon[]>;
}

function centerOf(item: PlacedFeature): number {
  return (item.from + item.to) / 2;
}

/**
 * A family with many copies (transposases) in either row links each upper copy
 * to its nearest lower one, so a gap never holds more ribbons than genes.
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

export function isLoner(
  families: FamilyIndex,
  feature: CompareRegionFeature,
): boolean {
  const family = feature.family;
  return (
    family !== null && family !== 1 && (families.rowCount.get(family) ?? 0) < 2
  );
}

export function familyReach(
  families: FamilyIndex,
  feature: CompareRegionFeature,
  rowTotal: number,
): string | null {
  if (feature.family === null) return null;
  const count = families.rowCount.get(feature.family) ?? 1;
  return `in ${String(count)} of ${String(rowTotal)} genomes`;
}

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

export function isSameFeature(
  a: FeatureRef | null | undefined,
  b: FeatureRef | null | undefined,
): boolean {
  return (
    !!a && !!b && a.rowIndex === b.rowIndex && a.featureIndex === b.featureIndex
  );
}

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

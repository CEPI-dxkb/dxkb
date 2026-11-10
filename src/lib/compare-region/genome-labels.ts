import type { CompareRegionFeature } from "./contract";
import type { DensitySpec } from "./density";
import type { RowFrame } from "./figure-frame";
import type { CompareRegionLayout } from "./layout";

export interface GenomeLabel {
  binomial: string;
  rest: string;
}

export function splitGenomeName(name: string): GenomeLabel {
  const words = name.split(/\s+/).filter(Boolean);
  const second = words.at(1) ?? "";
  const takeTwo = /^[a-z][a-z-]*\.?$/.test(second);
  const count = takeTwo ? 2 : 1;
  return {
    binomial: words.slice(0, count).join(" "),
    rest: words.slice(count).join(" "),
  };
}

export const capHeight = 0.72;

export interface GenomeLabelLines {
  middle: number;
  speciesBaseline: number;
  strainBaseline: number;
}

export function genomeLabelLines(
  spec: DensitySpec,
  rowFrame: RowFrame,
  hasStrain: boolean,
): GenomeLabelLines {
  const halfCap = (capHeight * spec.speciesSize) / 2;
  const halfTag = spec.tagHeight / 2;
  const above = Math.max(halfTag, halfCap);
  const below = hasStrain ? Math.max(halfTag, halfCap + spec.lineGap) : above;
  const slotMiddle = (rowFrame.slotTop + rowFrame.slotBottom) / 2;
  const middle = slotMiddle - (below - above) / 2;
  const speciesBaseline = middle + halfCap;
  return {
    middle,
    speciesBaseline,
    strainBaseline: speciesBaseline + spec.lineGap,
  };
}

export function centeredBaseline(middle: number, size: number): number {
  return middle + (capHeight * size) / 2;
}

export function rowIdentity(
  layout: CompareRegionLayout,
  rowIndex: number,
): number | null {
  const placed = layout.rows.at(rowIndex);
  if (!placed) return null;
  const pinned = placed.features.find(
    (item) => item.feature.fid === placed.row.pinnedFid,
  );
  if (pinned?.feature.identity != null) return pinned.feature.identity;
  const hit = placed.features.find((item) => item.feature.type === "blast");
  return hit?.feature.identity ?? null;
}

export function rowTagText(rowIndex: number): string {
  return String(rowIndex + 1).padStart(2, "0");
}

export const noProduct = "No product";

const bpFormat = new Intl.NumberFormat("en-US");

export function formatBp(value: number): string {
  return bpFormat.format(value);
}

export function formatLocation(feature: CompareRegionFeature): string {
  const size = formatBp(Math.abs(feature.end - feature.start) + 1);
  const strand = feature.strand ? `, ${feature.strand}` : "";
  return `${formatBp(feature.start)}…${formatBp(feature.end)} (${size} bp${strand})`;
}

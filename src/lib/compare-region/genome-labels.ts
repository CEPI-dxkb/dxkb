/**
 * The words the Compare Region Viewer shows about genomes and features: a
 * genome's name split into its binomial and the rest, a row's identity to
 * the focus gene and number tag, and a feature's location.
 */
import type { CompareRegionFeature } from "./contract";
import type { DensitySpec } from "./density";
import type { RowFrame } from "./figure-frame";
import type { CompareRegionLayout } from "./layout";

export interface GenomeLabel {
  /** Genus (and species): set in italics. */
  binomial: string;
  /** Strain and the rest. */
  rest: string;
}

/** "Brucella suis bv. 1 str. S2" → binomial "Brucella suis", rest "bv. 1 str. S2". */
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

/** Cap and figure height as a share of the font size, in the app's sans and mono fonts alike. */
export const capHeight = 0.72;

export interface GenomeLabelLines {
  /** The species line's middle (half its cap height up): the tag, the identity and "FOCUS" center on it. */
  middle: number;
  speciesBaseline: number;
  strainBaseline: number;
}

/**
 * Where a row's label sits, svg px: its ink (the tag and the species' caps,
 * down to the strain's baseline) centered in the row's slot, so it has as
 * much room above as below whatever lanes the row holds, with the tag, the
 * identity and "FOCUS" on the species' line.
 */
export function genomeLabelLines(
  spec: DensitySpec,
  rowFrame: RowFrame,
  hasStrain: boolean,
): GenomeLabelLines {
  const halfCap = (capHeight * spec.speciesSize) / 2;
  const halfTag = spec.tagHeight / 2;
  // The ink's reach above and below the species line's middle.
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

/** The baseline that centers `size` px caps or figures on `middle`. */
export function centeredBaseline(middle: number, size: number): number {
  return middle + (capHeight * size) / 2;
}

/** The pinned gene's identity to the focus gene (its BLAST hit's, failing that). */
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

/** A row's number tag: "01" for the focus row. */
export function rowTagText(rowIndex: number): string {
  return String(rowIndex + 1).padStart(2, "0");
}

export const noProduct = "No product";

const bpFormat = new Intl.NumberFormat("en-US");

/** "1,200". */
export function formatBp(value: number): string {
  return bpFormat.format(value);
}

/** "900…1,200 (301 bp, +)": the 5′ and 3′ ends, the length and the strand. */
export function formatLocation(feature: CompareRegionFeature): string {
  const size = formatBp(Math.abs(feature.end - feature.start) + 1);
  const strand = feature.strand ? `, ${feature.strand}` : "";
  return `${formatBp(feature.start)}…${formatBp(feature.end)} (${size} bp${strand})`;
}

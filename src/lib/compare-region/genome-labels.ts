/**
 * The words the Compare Region Viewer shows about genomes and features: a
 * genome's name split into its binomial and the rest (and fitted onto one
 * line in Compact), a row's identity to the focus gene and number tag, and
 * a feature's location.
 */
import type { CompareRegionFeature } from "./contract";
import { fitText, type TextMeasure } from "./labels";
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

/**
 * Compact's one-line name, px: the species (italic, weight 500), then the
 * strain, this far apart. `OneLineLabel` draws with these sizes and
 * `oneLineGenomeName` measures with them.
 */
export const oneLineSpeciesSize = 11;
export const oneLineStrainSize = 10;
export const oneLineStrainGap = 4;
const speciesFont = `italic 500 ${String(oneLineSpeciesSize)}px`;
const strainFont = `${String(oneLineStrainSize)}px`;

/**
 * Compact's genome label in `room` px: the species, then the strain, each
 * cut with "…" to fit (names are not data labels; the full name goes in the
 * row's title). The species gets the room first; the strain shows only when
 * the whole species does, as a bare "…" when none of it fits.
 */
export function oneLineGenomeName(
  genomeName: string,
  room: number,
  measure: TextMeasure,
): GenomeLabel {
  const name = splitGenomeName(genomeName);
  const binomial = fitText(name.binomial, room, speciesFont, measure);
  if (!name.rest || binomial !== name.binomial) return { binomial, rest: "" };
  const restRoom = room - measure(binomial, speciesFont) - oneLineStrainGap;
  const rest = fitText(name.rest, restRoom, strainFont, measure);
  if (rest) return { binomial, rest };
  return {
    binomial,
    rest: restRoom >= measure("…", strainFont) ? "…" : "",
  };
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

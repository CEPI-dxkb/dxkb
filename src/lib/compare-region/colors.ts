/**
 * The Compare Region Viewer's data colors: a feature's protein family, its
 * BLAST identity to the focus gene, the pinned gene's edge and the ink for
 * labels on a fill. They are OKLCH values for SVG `fill`/`stroke` attributes,
 * not theme tokens, and the same in every theme, so a family keeps its color
 * everywhere. The focus family is DXKB's orange in every theme too; the focus
 * line and the focus row's accents use the same constant.
 */
import type { CompareRegionFeature } from "./contract";

/** DXKB's orange in OKLCH (lightness in percent): the one source of the focus colors below. */
const focusOklch = { lightness: 71.57, chroma: 0.182, hue: 37.18 } as const;
const focusHue = focusOklch.hue;
/** "71.57% 0.182 37.18": the color's channels, for an opaque color or one with alpha. */
const focusChannels = [
  `${String(focusOklch.lightness)}%`,
  String(focusOklch.chroma),
  String(focusOklch.hue),
].join(" ");

/** DXKB's orange: the focus gene's family, the focus line and the BLAST ramp. */
export const focusFamilyColor = `oklch(${focusChannels})`;

/**
 * The focus row's "focus" text: DXKB's orange 20 points darker, so it reads
 * as text on a light card (about 5:1, where the orange itself is 2.5:1).
 */
export const focusInk = `oklch(${(focusOklch.lightness - 20).toFixed(2)}% ${String(focusOklch.chroma)} ${String(focusHue)})`;

/** `value` modulo `size`, never negative (`%` keeps the dividend's sign). */
function wrap(value: number, size: number): number {
  const rest = value % size;
  return rest < 0 ? rest + size : rest;
}

/** Degrees between two hues, the short way round. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A protein family's fill. Family 1 (the focus gene's) is the brand orange;
 * the rest step round the hue circle by the golden angle (the service numbers
 * families along the focus region, so neighbors get far-apart hues), skip the
 * orange/red wedge so the focus family stays unique, and cycle three
 * lightness tiers so two families of similar hue still differ.
 */
export function familyColor(family: number): string {
  if (family === 1) return focusFamilyColor;
  const n = family - 2;
  let hue = wrap(212 + n * 137.508, 360);
  if (hueDistance(hue, focusHue) < 32) hue = wrap(hue + 66, 360);
  const tier = wrap(n, 3);
  const lightness = [0.73, 0.645, 0.8][tier];
  const chroma = [0.12, 0.11, 0.095][tier];
  return `oklch(${String(lightness)} ${String(chroma)} ${hue.toFixed(1)})`;
}

/** BLAST identity to the focus gene: the brand orange, more opaque the closer. */
export function identityColor(identity: number): string {
  const share = Math.min(100, Math.max(0, identity)) / 100;
  return `oklch(${focusChannels} / ${(0.16 + 0.84 * share).toFixed(2)})`;
}

/** An opaque OKLCH color 0.2 lightness darker (the pinned gene's edge); any other color as it is. */
export function deepen(color: string): string {
  const match = /oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)/.exec(color);
  if (!match) return color;
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  return `oklch(${(lightness - 0.2).toFixed(3)} ${match[3]} ${match[4]})`;
}

/** Ink for labels on a family fill (every fill is light or mid, in either theme). */
export const labelInk = "oklch(0.25 0.03 265)";

/**
 * A feature's fill: a BLAST hit by its identity, a gene by its family (the
 * pinned gene included), and nothing for a feature in no family, which the
 * figure draws hatched.
 */
export function featurePaint(feature: CompareRegionFeature): string | undefined {
  if (feature.type === "blast") return identityColor(feature.identity ?? 0);
  return feature.family === null ? undefined : familyColor(feature.family);
}

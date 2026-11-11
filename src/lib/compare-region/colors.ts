/**
 * OKLCH values for SVG attributes, not theme tokens: the same in every theme,
 * so a family keeps its color everywhere.
 */
import type { CompareRegionFeature } from "./contract";

const focusOklch = { lightness: 71.57, chroma: 0.182, hue: 37.18 } as const;
const focusHue = focusOklch.hue;
const focusChannels = [
  `${String(focusOklch.lightness)}%`,
  String(focusOklch.chroma),
  String(focusOklch.hue),
].join(" ");

export const focusFamilyColor = `oklch(${focusChannels})`;

/**
 * Orange 20 points darker so it reads as text on a light card (about 5:1, where
 * the orange itself is 2.5:1).
 */
export const focusInk = `oklch(${(focusOklch.lightness - 20).toFixed(2)}% ${String(focusOklch.chroma)} ${String(focusHue)})`;

function wrap(value: number, size: number): number {
  const rest = value % size;
  return rest < 0 ? rest + size : rest;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Hues step by the golden angle, skip the orange/red wedge so the focus family
 * stays unique, and cycle three lightness tiers.
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

export function identityColor(identity: number): string {
  const share = Math.min(100, Math.max(0, identity)) / 100;
  return `oklch(${focusChannels} / ${(0.16 + 0.84 * share).toFixed(2)})`;
}

export function deepen(color: string): string {
  const match = /oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)/.exec(color);
  if (!match) return color;
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  return `oklch(${(lightness - 0.2).toFixed(3)} ${match[3]} ${match[4]})`;
}

export const labelInk = "oklch(0.25 0.03 265)";

export function featurePaint(feature: CompareRegionFeature): string | undefined {
  if (feature.type === "blast") return identityColor(feature.identity ?? 0);
  return feature.family === null ? undefined : familyColor(feature.family);
}

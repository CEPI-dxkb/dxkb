/**
 * SVG outlines of the Compare Region Viewer's glyphs, in pixels: softly
 * rounded gene arrows whose head and corners follow the density, and rounded
 * bars for BLAST hits and other features. Coordinates are rounded to a tenth
 * of a pixel, which keeps the paths short and stable across renders.
 */
import type { DensitySpec } from "./density";
import type { GlyphKind } from "./figure-frame";

/** A coordinate rounded to 0.1 px, as path text. */
export function roundPx(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * A closed path through `points`, each corner rounded by its radius (cut back
 * along both edges and joined by a quadratic curve through the corner).
 */
function roundedPolygon(
  points: [number, number][],
  radii: readonly number[],
): string {
  const parts: string[] = [];
  const count = points.length;
  points.forEach(([x, y], index) => {
    const [px, py] = points[(index - 1 + count) % count];
    const [nx, ny] = points[(index + 1) % count];
    const inLength = Math.hypot(px - x, py - y) || 1;
    const outLength = Math.hypot(nx - x, ny - y) || 1;
    const radius = Math.min(radii[index] ?? 0, inLength / 2, outLength / 2);
    const sx = x + ((px - x) / inLength) * radius;
    const sy = y + ((py - y) / inLength) * radius;
    const ex = x + ((nx - x) / outLength) * radius;
    const ey = y + ((ny - y) / outLength) * radius;
    parts.push(
      `${index === 0 ? "M" : "L"}${roundPx(sx)},${roundPx(sy)}`,
      `Q${roundPx(x)},${roundPx(y)} ${roundPx(ex)},${roundPx(ey)}`,
    );
  });
  return `${parts.join("")}Z`;
}

/**
 * A full-height arrow (pentagon) from the 5′ end `x1` to the 3′ end `x2`,
 * softly rounded; a triangle when the gene is no longer than its head.
 */
export function arrowPath(
  spec: DensitySpec,
  x1: number,
  x2: number,
  top: number,
  height: number,
): string {
  const bottom = top + height;
  const middle = top + height / 2;
  const length = Math.abs(x2 - x1);
  const direction = x2 >= x1 ? 1 : -1;
  if (length <= spec.headLength) {
    return roundedPolygon(
      [
        [x1, top],
        [x2, middle],
        [x1, bottom],
      ],
      spec.shortArrowRadii,
    );
  }
  const neck = x2 - direction * spec.headLength;
  return roundedPolygon(
    [
      [x1, top],
      [neck, top],
      [x2, middle],
      [neck, bottom],
      [x1, bottom],
    ],
    spec.arrowRadii,
  );
}

/** A rounded bar (BLAST hits, other features), at least 1 px wide. */
export function barPath(
  x1: number,
  x2: number,
  top: number,
  height: number,
  radius: number,
): string {
  const left = Math.min(x1, x2);
  const width = Math.max(Math.abs(x2 - x1), 1);
  const r = Math.min(radius, width / 2, height / 2);
  const right = left + width;
  const bottom = top + height;
  return [
    `M${roundPx(left + r)},${roundPx(top)}`,
    `H${roundPx(right - r)}`,
    `Q${roundPx(right)},${roundPx(top)} ${roundPx(right)},${roundPx(top + r)}`,
    `V${roundPx(bottom - r)}`,
    `Q${roundPx(right)},${roundPx(bottom)} ${roundPx(right - r)},${roundPx(bottom)}`,
    `H${roundPx(left + r)}`,
    `Q${roundPx(left)},${roundPx(bottom)} ${roundPx(left)},${roundPx(bottom - r)}`,
    `V${roundPx(top + r)}`,
    `Q${roundPx(left)},${roundPx(top)} ${roundPx(left + r)},${roundPx(top)}Z`,
  ].join("");
}

/** The glyph outline for any feature kind, between `top` and `bottom`. */
export function glyphPath(
  spec: DensitySpec,
  kind: GlyphKind,
  x1: number,
  x2: number,
  top: number,
  bottom: number,
): string {
  const height = bottom - top;
  if (kind === "blast") return barPath(x1, x2, top, height, height / 2);
  if (kind === "other") return barPath(x1, x2, top, height, spec.otherRadius);
  return arrowPath(spec, x1, x2, top, height);
}

/**
 * Where one of the Compare Region Viewer's glyphs goes at the current zoom:
 * its kind, outline and label, or nothing when it lies off the plot. The
 * glyph layer and the family trace both place their glyphs through
 * `placeGlyph`, so a traced gene is redrawn exactly over its glyph.
 */
import type { DensitySpec } from "./density";
import {
  glyphBox,
  glyphKind,
  type GlyphKind,
  type RowFrame,
} from "./figure-frame";
import { glyphPath } from "./glyph-paths";
import { glyphLabel, type GlyphLabel, type TextMeasure } from "./labels";
import type { PlacedFeature } from "./layout";

/**
 * Whether a span from `from` to `to` (px, either way round) lies wholly off a
 * plot `plotWidth` wide, beyond `margin` px of either edge. A point is a span
 * of no width.
 */
export function isOffPlot(
  from: number,
  to: number,
  plotWidth: number,
  margin = 1,
): boolean {
  return (
    Math.max(from, to) < -margin || Math.min(from, to) > plotWidth + margin
  );
}

export interface GlyphPlacement {
  kind: GlyphKind;
  /** The outline's SVG path. */
  d: string;
  /** The label that fits whole, if any. */
  label: GlyphLabel | null;
}

/**
 * `item`'s glyph in its row, under the zoom's bp-to-px scale `x`. Null when it
 * lies more than `reach` px off the plot (zoomed in, most do): 0 at rest, a
 * plot's width while a drag pans (`panReach`), and `Infinity` for the glyph a
 * drag pressed, since removing it would lose the pointer.
 */
export function placeGlyph(
  spec: DensitySpec,
  rowFrame: RowFrame,
  item: PlacedFeature,
  x: (offset: number) => number,
  plotWidth: number,
  measure: TextMeasure,
  reach = 0,
): GlyphPlacement | null {
  const x1 = x(item.from);
  const x2 = x(item.to);
  if (isOffPlot(x1, x2, plotWidth, 1 + reach)) return null;
  const kind = glyphKind(item.feature);
  const box = glyphBox(spec, rowFrame, item);
  return {
    kind,
    d: glyphPath(spec, kind, x1, x2, box.top, box.bottom),
    label: glyphLabel(spec, kind, item, x1, x2, box, plotWidth, measure),
  };
}

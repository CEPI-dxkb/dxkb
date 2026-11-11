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
  d: string;
  label: GlyphLabel | null;
}

/**
 * Null when it lies more than `reach` px off the plot; `Infinity` for the glyph
 * a drag pressed, since removing it would lose the pointer.
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

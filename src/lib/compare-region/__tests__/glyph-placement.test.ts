import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { densitySpecs } from "../density";
import { buildChartModel } from "../families";
import { glyphBox, glyphKind } from "../figure-frame";
import { glyphPath } from "../glyph-paths";
import { isOffPlot, placeGlyph } from "../glyph-placement";
import { glyphLabel } from "../labels";
import { trackScale } from "../ruler";
import { estimateTextWidth } from "../text-measure";

/** A 900 px card: Comfortable's plot beside its 226 px label column. */
const plotWidth = 674;
const measure = estimateTextWidth;
const model = buildChartModel(
  [focusRow, mirroredRow],
  densitySpecs.comfortable,
);
const { spec } = model;

describe("isOffPlot", () => {
  it("keeps a span within a pixel of the plot, whichever way it runs", () => {
    expect(isOffPlot(-5, -1, 100)).toBe(false);
    expect(isOffPlot(-1, -5, 100)).toBe(false);
    expect(isOffPlot(-5, -1.1, 100)).toBe(true);
    expect(isOffPlot(-1.1, -5, 100)).toBe(true);
    expect(isOffPlot(101, 120, 100)).toBe(false);
    expect(isOffPlot(101.1, 120, 100)).toBe(true);
    expect(isOffPlot(-50, 150, 100)).toBe(false);
  });

  it("takes a wider margin for a line (the focus line keeps 2 px)", () => {
    expect(isOffPlot(-2, -2, 100, 2)).toBe(false);
    expect(isOffPlot(-2.1, -2.1, 100, 2)).toBe(true);
    expect(isOffPlot(102, 102, 100, 2)).toBe(false);
    expect(isOffPlot(102.1, 102.1, 100, 2)).toBe(true);
  });
});

describe("placeGlyph", () => {
  it("places every glyph as its kind, box, path and label say", () => {
    const x = trackScale(
      model.layout.domain,
      { scaleX: 1, translateX: 0 },
      plotWidth,
    );
    model.layout.rows.forEach((placed, rowIndex) => {
      const rowFrame = model.frame.rows[rowIndex];
      for (const item of placed.features) {
        const kind = glyphKind(item.feature);
        const box = glyphBox(spec, rowFrame, item);
        const x1 = x(item.from);
        const x2 = x(item.to);
        expect(placeGlyph(spec, rowFrame, item, x, plotWidth, measure)).toEqual(
          {
            kind,
            d: glyphPath(spec, kind, x1, x2, box.top, box.bottom),
            label: glyphLabel(
              spec,
              kind,
              item,
              x1,
              x2,
              box,
              plotWidth,
              measure,
            ),
          },
        );
      }
    });
  });

  it("skips a glyph further off the plot than its reach", () => {
    // 2.25× about the focus line leaves the upstream gene 118 px left of the window.
    const x = trackScale(
      model.layout.domain,
      { scaleX: 2.25, translateX: -421.25 },
      plotWidth,
    );
    const rowFrame = model.frame.rows[0];
    const [upstream, focusGene] = model.layout.rows[0].features;
    const place = (item: typeof upstream, reach?: number) =>
      placeGlyph(spec, rowFrame, item, x, plotWidth, measure, reach);
    expect(place(upstream)).toBeNull();
    expect(place(upstream, 100)).toBeNull();
    expect(place(upstream, 117)).toEqual(
      expect.objectContaining({ kind: "gene" }),
    );
    expect(place(upstream, Infinity)).not.toBeNull();
    expect(place(focusGene)).not.toBeNull();
  });
});

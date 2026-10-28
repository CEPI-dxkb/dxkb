import type { CompareRegionRow } from "../contract";
import {
  compareRegionDensities,
  compareRegionDensityHints,
  compareRegionDensityLabels,
} from "../density-options";
import {
  densitySpecs,
  labelWidthFor,
  minPlotWidth,
  plotWidthFor,
  rulerHeight,
} from "../density";
import { measureFigure } from "../figure-frame";
import { layoutCompareRegion } from "../layout";
import rows10 from "./fixtures/rows-10.json";
import rows20 from "./fixtures/rows-20.json";
import rows50 from "./fixtures/rows-50.json";

const { comfortable, compact } = densitySpecs;

describe("density options", () => {
  it("lists Comfortable first, with a label and a hint for each", () => {
    expect(compareRegionDensities).toEqual(["comfortable", "compact"]);
    expect(compareRegionDensityLabels).toEqual({
      comfortable: "Comfortable",
      compact: "Compact",
    });
    expect(compareRegionDensityHints).toEqual({
      comfortable: "Show bigger rows that are easier to read.",
      compact: "Shrink the rows to fit more genomes on screen.",
    });
  });
});

describe("densitySpecs", () => {
  it("keeps the ruler and the plot floor the same in both densities", () => {
    expect(rulerHeight).toBe(30);
    expect(minPlotWidth).toBe(420);
  });

  it("sizes Comfortable rows roomier than Compact ones", () => {
    expect(comfortable).toEqual(
      expect.objectContaining({
        geneHeight: 16,
        overlapHeight: 16,
        blastHeight: 5,
        headLength: 7,
        restingRibbons: "bands",
        rowTint: false,
        speciesSize: 13,
        strainSize: 11.5,
      }),
    );
    expect(compact).toEqual(
      expect.objectContaining({
        geneHeight: 12,
        overlapHeight: 8,
        blastHeight: 3,
        headLength: 5.5,
        restingRibbons: "connectors",
        rowTint: true,
        speciesSize: 12,
        strainSize: 10.5,
      }),
    );
  });
});

describe("labelWidthFor", () => {
  it.each([
    [699, 208, 176],
    [700, 238, 204],
    [1099, 238, 204],
    [1100, 280, 232],
  ])("gives a %i px card a %i / %i px label column", (width, wide, narrow) => {
    expect(labelWidthFor(comfortable, width)).toBe(wide);
    expect(labelWidthFor(compact, width)).toBe(narrow);
  });
});

describe("plotWidthFor", () => {
  it("gives the plot the rest of the card", () => {
    expect(plotWidthFor(comfortable, 900)).toBe(662);
    expect(plotWidthFor(compact, 900)).toBe(696);
    expect(plotWidthFor(comfortable, 1440)).toBe(1160);
    expect(plotWidthFor(compact, 1440)).toBe(1208);
  });

  it("never narrows the plot below the floor, so a narrow card scrolls sideways", () => {
    expect(plotWidthFor(comfortable, 300)).toBe(420);
    expect(
      labelWidthFor(comfortable, 300) + plotWidthFor(comfortable, 300),
    ).toBe(628);
    expect(labelWidthFor(compact, 300) + plotWidthFor(compact, 300)).toBe(596);
  });
});

describe("figure heights for real answers", () => {
  it.each([
    [10, 614, 400, rows10.rows],
    [20, 1298, 822, rows20.rows],
    [50, 2942, 1884, rows50.rows],
  ])(
    "draws %i genomes %i px tall in Comfortable and %i px in Compact",
    (count, comfortableHeight, compactHeight, rows) => {
      const layout = layoutCompareRegion(rows as CompareRegionRow[]);
      expect(layout.rows).toHaveLength(count);
      expect(measureFigure(layout, comfortable).height).toBe(comfortableHeight);
      expect(measureFigure(layout, compact).height).toBe(compactHeight);
    },
  );
});

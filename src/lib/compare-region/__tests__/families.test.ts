import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import type { CompareRegionFeature, CompareRegionRow } from "../contract";
import { densitySpecs } from "../density";
import {
  bridgeRibbons,
  buildChartModel,
  familyReach,
  focusMembers,
  indexFamilies,
  isLoner,
  resolveFeature,
} from "../families";
import { measureFigure } from "../figure-frame";
import { layoutCompareRegion } from "../layout";
import rows10 from "./fixtures/rows-10.json";

/** A plus-strand row centered at 1000 over a 2 kb window, aligned on its first feature. */
function testRow(
  genomeId: string,
  features: CompareRegionFeature[],
): CompareRegionRow {
  return {
    genomeId,
    genomeName: `Genome ${genomeId}`,
    start: 0,
    end: 2000,
    contigLength: null,
    pinnedFid: features[0].fid,
    pinnedStrand: "+",
    center: 1000,
    features,
  };
}

function focusGene(genomeId: string): CompareRegionFeature {
  return testGene(`fig|${genomeId}.peg.1`, 900, 1200, { family: 1 });
}

const layout = layoutCompareRegion([focusRow, mirroredRow]);

describe("resolveFeature", () => {
  it("finds a feature's row and feature by its ref", () => {
    expect(resolveFeature(layout, { rowIndex: 1, featureIndex: 0 })).toEqual({
      row: mirroredRow,
      feature: mirroredRow.features[0],
    });
  });

  it("is null without a ref or for a ref past the layout", () => {
    expect(resolveFeature(layout, undefined)).toBeNull();
    expect(resolveFeature(layout, null)).toBeNull();
    expect(resolveFeature(layout, { rowIndex: 2, featureIndex: 0 })).toBeNull();
    expect(resolveFeature(layout, { rowIndex: 1, featureIndex: 4 })).toBeNull();
  });
});

describe("indexFamilies", () => {
  it("indexes each family's members, its rows and the ribbons across each gap", () => {
    const families = indexFamilies(layout);
    expect(families.members).toEqual(
      new Map([
        [3, [{ rowIndex: 0, featureIndex: 0 }]],
        [
          1,
          [
            { rowIndex: 0, featureIndex: 1 },
            { rowIndex: 1, featureIndex: 0 },
          ],
        ],
      ]),
    );
    expect(families.rowCount).toEqual(
      new Map([
        [3, 1],
        [1, 2],
      ]),
    );
    expect(families.ribbons).toEqual([
      {
        family: 1,
        upper: { rowIndex: 0, featureIndex: 1 },
        lower: { rowIndex: 1, featureIndex: 0 },
      },
    ]);
    expect(families.ribbonsByFamily).toEqual(new Map([[1, families.ribbons]]));
  });

  it("links a copy to the nearest of more than two matches below, and to both of two", () => {
    const upper = testRow("1.1", [
      focusGene("1.1"),
      testGene("fig|1.1.peg.2", 1300, 1500, { family: 5 }),
    ]);
    const three = testRow("2.1", [
      focusGene("2.1"),
      testGene("fig|2.1.peg.2", 100, 300, { family: 5 }),
      testGene("fig|2.1.peg.3", 1350, 1550, { family: 5 }),
      testGene("fig|2.1.peg.4", 1700, 1900, { family: 5 }),
    ]);
    const two = testRow("3.1", [
      focusGene("3.1"),
      testGene("fig|3.1.peg.2", 100, 300, { family: 5 }),
      testGene("fig|3.1.peg.3", 1350, 1550, { family: 5 }),
    ]);
    const nearest = indexFamilies(layoutCompareRegion([upper, three]));
    expect(nearest.ribbons.filter((ribbon) => ribbon.family === 5)).toEqual([
      {
        family: 5,
        upper: { rowIndex: 0, featureIndex: 1 },
        lower: { rowIndex: 1, featureIndex: 2 },
      },
    ]);
    const both = indexFamilies(layoutCompareRegion([upper, two]));
    expect(
      both.ribbons
        .filter((ribbon) => ribbon.family === 5)
        .map((ribbon) => ribbon.lower),
    ).toEqual([
      { rowIndex: 1, featureIndex: 1 },
      { rowIndex: 1, featureIndex: 2 },
    ]);
  });

  it("links each of more than two copies above to its nearest match below, however few", () => {
    const three = testRow("1.1", [
      focusGene("1.1"),
      testGene("fig|1.1.peg.2", 100, 300, { family: 5 }),
      testGene("fig|1.1.peg.3", 1300, 1500, { family: 5 }),
      testGene("fig|1.1.peg.4", 1700, 1900, { family: 5 }),
    ]);
    const two = testRow("2.1", [
      focusGene("2.1"),
      testGene("fig|2.1.peg.2", 120, 320, { family: 5 }),
      testGene("fig|2.1.peg.3", 1350, 1550, { family: 5 }),
    ]);
    const families = indexFamilies(layoutCompareRegion([three, two]));
    // Three ribbons across a gap of five genes, not all six pairs.
    expect(
      families.ribbons
        .filter((ribbon) => ribbon.family === 5)
        .map((ribbon) => [ribbon.upper.featureIndex, ribbon.lower.featureIndex]),
    ).toEqual([
      [1, 1],
      [2, 2],
      [3, 2],
    ]);
  });

  it("still joins every pair of a family with two copies on each side", () => {
    const rows = ["1.1", "2.1"].map((id) =>
      testRow(id, [
        focusGene(id),
        testGene(`fig|${id}.peg.2`, 100, 300, { family: 5 }),
        testGene(`fig|${id}.peg.3`, 1350, 1550, { family: 5 }),
      ]),
    );
    const families = indexFamilies(layoutCompareRegion(rows));
    expect(
      families.ribbons.filter((ribbon) => ribbon.family === 5),
    ).toHaveLength(4);
  });

  it("sorts the focus family's ribbons last, so they draw on top", () => {
    const rows = ["1.1", "2.1"].map((id) =>
      testRow(id, [
        focusGene(id),
        testGene(`fig|${id}.peg.2`, 1300, 1500, { family: 5 }),
      ]),
    );
    const families = indexFamilies(layoutCompareRegion(rows));
    expect(families.ribbons.map((ribbon) => ribbon.family)).toEqual([5, 1]);
  });

  it("indexes the 10-genome answer: 67 families, 52 in one genome only, 39 ribbons", () => {
    const families = indexFamilies(
      layoutCompareRegion(rows10.rows as CompareRegionRow[]),
    );
    expect(families.members.size).toBe(67);
    expect(families.rowCount.get(1)).toBe(10);
    expect(
      [...families.rowCount.values()].filter((count) => count < 2),
    ).toHaveLength(52);
    expect(families.ribbons).toHaveLength(39);
    expect(families.ribbonsByFamily.get(1)).toHaveLength(9);
    expect(
      families.ribbons.slice(-9).every((ribbon) => ribbon.family === 1),
    ).toBe(true);
  });
});

describe("bridgeRibbons", () => {
  const rows = [
    testRow("1.1", [
      focusGene("1.1"),
      testGene("fig|1.1.peg.2", 1300, 1500, { family: 7 }),
      testGene("fig|1.1.peg.3", 100, 300, { family: 8 }),
    ]),
    testRow("2.1", [
      focusGene("2.1"),
      testGene("fig|2.1.peg.2", 100, 300, { family: 8 }),
    ]),
    testRow("3.1", [
      focusGene("3.1"),
      testGene("fig|3.1.peg.2", 100, 300, { family: 7 }),
      testGene("fig|3.1.peg.3", 1350, 1550, { family: 7 }),
    ]),
  ];
  const bridged = layoutCompareRegion(rows);
  const families = indexFamilies(bridged);

  it("bridges a genome without the family with the nearest pair of members", () => {
    expect(bridgeRibbons(bridged, families, 7)).toEqual([
      {
        family: 7,
        upper: { rowIndex: 0, featureIndex: 1 },
        lower: { rowIndex: 2, featureIndex: 2 },
      },
    ]);
  });

  it("needs no bridge between adjacent rows, or for a family it does not know", () => {
    expect(bridgeRibbons(bridged, families, 8)).toEqual([]);
    expect(bridgeRibbons(bridged, families, 1)).toEqual([]);
    expect(bridgeRibbons(bridged, families, 99)).toEqual([]);
  });
});

describe("isLoner", () => {
  const families = indexFamilies(layout);

  it("marks a family seen in one genome only", () => {
    expect(isLoner(families, focusRow.features[0])).toBe(true);
    expect(isLoner(families, focusRow.features[1])).toBe(false);
  });

  it("never marks the focus family or a feature with no family", () => {
    const alone = indexFamilies(layoutCompareRegion([focusRow]));
    expect(isLoner(alone, focusRow.features[1])).toBe(false);
    expect(isLoner(families, focusRow.features[2])).toBe(false);
  });
});

describe("familyReach", () => {
  const families = indexFamilies(layout);

  it("says how many of the genomes have the family", () => {
    expect(familyReach(families, focusRow.features[1], 2)).toBe(
      "in 2 of 2 genomes",
    );
    expect(familyReach(families, focusRow.features[0], 2)).toBe(
      "in 1 of 2 genomes",
    );
  });

  it("is null for a feature with no family", () => {
    expect(familyReach(families, focusRow.features[2], 2)).toBeNull();
  });
});

describe("buildChartModel", () => {
  it("lays out, measures and indexes the rows once, for one density", () => {
    const spec = densitySpecs.compact;
    const model = buildChartModel([focusRow, mirroredRow], spec);
    expect(model.layout).toEqual(layout);
    expect(model.frame).toEqual(measureFigure(layout, spec));
    expect(model.families).toEqual(indexFamilies(layout));
    expect(model.spec).toBe(spec);
  });
});

describe("focusMembers", () => {
  const model = buildChartModel(
    [focusRow, mirroredRow],
    densitySpecs.comfortable,
  );

  it("is every member of the focus gene's family", () => {
    expect(focusMembers(model, { rowIndex: 0, featureIndex: 1 })).toEqual([
      { rowIndex: 0, featureIndex: 1 },
      { rowIndex: 1, featureIndex: 0 },
    ]);
  });

  it("is just the feature when it has no family", () => {
    expect(focusMembers(model, { rowIndex: 0, featureIndex: 2 })).toEqual([
      { rowIndex: 0, featureIndex: 2 },
    ]);
  });

  it("is empty with no focus, or a focus past the layout", () => {
    expect(focusMembers(model, undefined)).toEqual([]);
    expect(focusMembers(model, { rowIndex: 5, featureIndex: 0 })).toEqual([]);
  });
});

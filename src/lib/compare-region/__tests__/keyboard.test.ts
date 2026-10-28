import type { TransformMatrix } from "@visx/zoom";
import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import type { CompareRegionRow } from "../contract";
import {
  defaultTabStop,
  featureName,
  featureStepKeys,
  revealMatrix,
  revealScroll,
  rowName,
  screenOrder,
  stepFeature,
} from "../keyboard";
import { layoutCompareRegion, type PlacedFeature } from "../layout";

function matrix(scaleX: number, translateX: number): TransformMatrix {
  return { scaleX, scaleY: 1, translateX, translateY: 0, skewX: 0, skewY: 0 };
}

/** A mirrored row whose service order (contig order) runs right to left on screen. */
const mirroredPair: CompareRegionRow = {
  ...mirroredRow,
  features: [
    testGene("fig|2.1.peg.6", 4100, 4400, { product: "Right of the pin" }),
    ...mirroredRow.features,
  ],
};

const layout = layoutCompareRegion([focusRow, mirroredPair]);

/** A placed feature spanning `from`…`to` (bp offsets). */
function span(from: number, to: number): PlacedFeature {
  return { feature: testGene("fig|9.9.peg.1", 1, 2), from, to, lane: 0 };
}

describe("screenOrder", () => {
  it("orders a row's features left to right, the upper lane first", () => {
    // The upstream gene, then the focus gene over its BLAST hit (same middle).
    expect(screenOrder(layout.rows[0])).toEqual([0, 1, 2]);
  });

  it("orders a mirrored row as it stands on screen, not in contig order", () => {
    expect(screenOrder(layout.rows[1])).toEqual([1, 0]);
  });
});

describe("stepFeature", () => {
  const focusGene = { rowIndex: 0, featureIndex: 1 };

  it("moves along the row", () => {
    expect(stepFeature(layout, focusGene, "previous")).toEqual({
      rowIndex: 0,
      featureIndex: 0,
    });
    expect(stepFeature(layout, focusGene, "next")).toEqual({
      rowIndex: 0,
      featureIndex: 2,
    });
  });

  it("moves along a mirrored row in screen order", () => {
    expect(
      stepFeature(layout, { rowIndex: 1, featureIndex: 1 }, "next"),
    ).toEqual({ rowIndex: 1, featureIndex: 0 });
  });

  it("moves to the row's ends", () => {
    expect(stepFeature(layout, focusGene, "first")).toEqual({
      rowIndex: 0,
      featureIndex: 0,
    });
    expect(stepFeature(layout, focusGene, "last")).toEqual({
      rowIndex: 0,
      featureIndex: 2,
    });
  });

  it("goes nowhere past a row's end, nor to the gene it is on", () => {
    const upstream = { rowIndex: 0, featureIndex: 0 };
    expect(stepFeature(layout, upstream, "previous")).toBeNull();
    expect(stepFeature(layout, upstream, "first")).toBeNull();
    const hit = { rowIndex: 0, featureIndex: 2 };
    expect(stepFeature(layout, hit, "next")).toBeNull();
    expect(stepFeature(layout, hit, "last")).toBeNull();
  });

  it("moves to the nearest gene in the next row, the upper lane winning a tie", () => {
    expect(stepFeature(layout, focusGene, "down")).toEqual({
      rowIndex: 1,
      featureIndex: 1,
    });
    // The homolog's middle matches both the focus gene and its BLAST hit.
    expect(
      stepFeature(layout, { rowIndex: 1, featureIndex: 1 }, "up"),
    ).toEqual(focusGene);
    expect(
      stepFeature(layout, { rowIndex: 0, featureIndex: 0 }, "down"),
    ).toEqual({ rowIndex: 1, featureIndex: 1 });
  });

  it("skips rows with no features, and goes nowhere past the first or last row", () => {
    const withGap = layoutCompareRegion([
      focusRow,
      { ...mirroredRow, features: [] },
      mirroredRow,
    ]);
    expect(stepFeature(withGap, focusGene, "down")).toEqual({
      rowIndex: 2,
      featureIndex: 0,
    });
    expect(stepFeature(withGap, focusGene, "up")).toBeNull();
    expect(
      stepFeature(withGap, { rowIndex: 2, featureIndex: 0 }, "down"),
    ).toBeNull();
  });

  it("goes nowhere from a feature the layout does not have", () => {
    expect(
      stepFeature(layout, { rowIndex: 5, featureIndex: 0 }, "next"),
    ).toBeNull();
  });

  it("maps the arrow keys, Home and End", () => {
    expect(featureStepKeys).toEqual({
      ArrowLeft: "previous",
      ArrowRight: "next",
      Home: "first",
      End: "last",
      ArrowUp: "up",
      ArrowDown: "down",
    });
  });
});

describe("defaultTabStop", () => {
  it("rests on the focus gene", () => {
    expect(defaultTabStop(layout)).toEqual({ rowIndex: 0, featureIndex: 1 });
  });

  it("falls back to the first gene on screen in the first row that has any", () => {
    const unpinned = layoutCompareRegion([
      { ...focusRow, features: [] },
      mirroredPair,
    ]);
    expect(defaultTabStop(unpinned)).toEqual({ rowIndex: 1, featureIndex: 1 });
  });

  it("is null for a figure with no features", () => {
    expect(
      defaultTabStop(layoutCompareRegion([{ ...focusRow, features: [] }])),
    ).toBeNull();
    expect(defaultTabStop(layoutCompareRegion([]))).toBeNull();
  });
});

describe("featureName", () => {
  it("names a gene by its product, then its ID", () => {
    expect(featureName(focusRow.features[1])).toBe(
      "Focus protein, fig|1.1.peg.2",
    );
  });

  it("names any other feature's kind first", () => {
    expect(featureName(focusRow.features[2])).toBe(
      "BLAST hit: blast hit for pin, fig|1.1.peg.2.BLAST",
    );
    expect(
      featureName(testGene("fig|1.1.peg.9", 1, 90, { type: "pseudogene" })),
    ).toBe("Pseudogene: hypothetical protein, fig|1.1.peg.9");
    expect(
      featureName(
        testGene("fig|1.1.rna.3", 1, 90, { type: "tRNA", product: "tRNA-Leu" }),
      ),
    ).toBe("tRNA: tRNA-Leu, fig|1.1.rna.3");
  });

  it("words a missing product as the tooltip does", () => {
    expect(featureName(testGene("fig|1.1.peg.9", 1, 90, { product: "" }))).toBe(
      "No product, fig|1.1.peg.9",
    );
  });
});

describe("rowName", () => {
  it("names a row by its number tag and its genome", () => {
    expect(rowName(0, "Escherichia coli")).toBe("Genome 01: Escherichia coli");
    expect(rowName(11, "Salmonella enterica")).toBe(
      "Genome 12: Salmonella enterica",
    );
  });
});

describe("revealMatrix", () => {
  // 1,000 px over 2 kb: at 4×, 2 px a base.
  const domain: [number, number] = [-1000, 1000];

  it("leaves a feature already in view where it is", () => {
    const at = matrix(4, -150);
    expect(revealMatrix(domain, at, 1000, span(-900, -600))).toBe(at);
  });

  it("pans the least that brings a feature left of the plot in, 8 px inside", () => {
    // At −1,000 px the feature spans −800…−200 px.
    expect(revealMatrix(domain, matrix(4, -1000), 1000, span(-900, -600))).toEqual(
      matrix(4, -192),
    );
  });

  it("pans the least that brings a feature right of the plot in, 8 px inside", () => {
    // At −1,000 px the feature spans 800…1,400 px.
    expect(revealMatrix(domain, matrix(4, -1000), 1000, span(-100, 200))).toEqual(
      matrix(4, -1408),
    );
  });

  it("brings a feature wider than the plot in at its start", () => {
    // At 20×, 10 px a base: 3,000 px wide, from −500 px.
    expect(revealMatrix(domain, matrix(20, -9500), 1000, span(200, -100))).toEqual(
      matrix(20, -8992),
    );
  });

  it("never pans past the window's ends", () => {
    const whole = matrix(1, 0);
    // At 1× the window's first bases sit at 0 px, inside the 8 px margin.
    expect(revealMatrix(domain, whole, 1000, span(-1000, -990))).toBe(whole);
  });
});

describe("revealScroll", () => {
  // The label column covers 120 px on the left, the ruler 30 px on top.
  const view = { left: 0, top: 100, width: 500, height: 300 };
  const inset = { left: 120, top: 30 };

  it("stays put while the box is in view", () => {
    expect(
      revealScroll(view, { left: 200, right: 300, top: 200, bottom: 220 }, inset),
    ).toEqual({ left: 0, top: 100 });
  });

  it("scrolls up the least that brings a box under the ruler clear of it", () => {
    expect(
      revealScroll(view, { left: 200, right: 300, top: 110, bottom: 130 }, inset),
    ).toEqual({ left: 0, top: 72 });
  });

  it("scrolls down the least that brings a box below the view in", () => {
    expect(
      revealScroll(view, { left: 200, right: 300, top: 500, bottom: 520 }, inset),
    ).toEqual({ left: 0, top: 228 });
  });

  it("scrolls sideways clear of the label column, or to the right edge", () => {
    expect(
      revealScroll(
        { ...view, left: 50 },
        { left: 100, right: 150, top: 200, bottom: 220 },
        inset,
      ),
    ).toEqual({ left: 0, top: 100 });
    expect(
      revealScroll(view, { left: 600, right: 700, top: 200, bottom: 220 }, inset),
    ).toEqual({ left: 208, top: 100 });
  });

  it("brings a box larger than the view in at its start", () => {
    expect(
      revealScroll(view, { left: 200, right: 300, top: 150, bottom: 1000 }, inset),
    ).toEqual({ left: 0, top: 112 });
  });
});

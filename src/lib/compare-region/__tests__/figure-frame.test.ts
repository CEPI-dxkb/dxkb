import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import type { CompareRegionRow } from "../contract";
import { densitySpecs } from "../density";
import { glyphBox, glyphKind, measureFigure, rowAt } from "../figure-frame";
import { layoutCompareRegion, type PlacedFeature } from "../layout";

const { comfortable, compact } = densitySpecs;
const layout = layoutCompareRegion([focusRow, mirroredRow]);

/** The focus row with a second gene overlapping the pinned one, so lane 1 holds a gene. */
const overlapRow: CompareRegionRow = {
  ...focusRow,
  features: [
    testGene("fig|1.1.peg.2", 900, 1200, { family: 1, identity: 100 }),
    testGene("fig|1.1.peg.3", 1100, 1500, { family: 4 }),
  ],
};
const overlapLayout = layoutCompareRegion([overlapRow, mirroredRow]);

function placed(
  overrides: Parameters<typeof testGene>[3],
  lane: number,
): PlacedFeature {
  return {
    feature: testGene("fig|1.1.peg.9", 1, 2, overrides),
    from: 0,
    to: 10,
    lane,
  };
}

describe("glyphKind", () => {
  it.each([
    [{ family: 2 }, "gene"],
    [{ family: null }, "orphan"],
    [{ type: "domain_hit", family: 5 }, "gene"],
    [{ type: "blast" }, "blast"],
    [{ type: "pseudogene" }, "pseudo"],
    [{ type: "tRNA" }, "other"],
    [{ type: "repeat" }, "other"],
  ] as const)("draws %o as a %s", (overrides, kind) => {
    expect(glyphKind(testGene("fig|1.1.peg.9", 1, 2, overrides))).toBe(kind);
  });
});

describe("measureFigure", () => {
  it("measures Comfortable rows: a gene lane, a thin BLAST lane, then the ribbon gap", () => {
    const frame = measureFigure(layout, comfortable);
    expect(frame.rows[0]).toEqual(
      expect.objectContaining({
        laneTops: [46, 65],
        top: 46,
        bottom: 70,
        center: 54,
        slotTop: 30,
        slotBottom: 84,
      }),
    );
    expect(frame.rows[1]).toEqual(
      expect.objectContaining({
        laneTops: [98],
        bottom: 114,
        center: 106,
        slotTop: 84,
        slotBottom: 130,
      }),
    );
    expect(frame.dividers).toEqual([84]);
    expect(frame.height).toBe(130);
  });

  it("measures Compact rows tighter", () => {
    const frame = measureFigure(layout, compact);
    expect(frame.rows[0]).toEqual(
      expect.objectContaining({
        laneTops: [39, 52],
        top: 39,
        bottom: 55,
        center: 45,
        slotTop: 30,
        slotBottom: 64,
      }),
    );
    expect(frame.rows[1]).toEqual(
      expect.objectContaining({
        laneTops: [73],
        bottom: 85,
        center: 79,
        slotTop: 64,
        slotBottom: 94,
      }),
    );
    expect(frame.dividers).toEqual([64]);
    expect(frame.height).toBe(94);
  });

  it("gives a lane of overlapping genes the overlap height, not a BLAST bar's", () => {
    const roomy = measureFigure(overlapLayout, comfortable);
    expect(roomy.rows[0]).toEqual(
      expect.objectContaining({
        laneTops: [46, 66],
        bottom: 82,
        slotTop: 30,
        slotBottom: 96,
      }),
    );
    const tight = measureFigure(overlapLayout, compact);
    expect(tight.rows[0]).toEqual(
      expect.objectContaining({
        laneTops: [39, 53],
        bottom: 61,
        slotTop: 30,
        slotBottom: 70,
      }),
    );
  });

  it("steps rows by 52 / 34 px under a BLAST lane and 64 / 40 px under an overlap lane", () => {
    const pitch = (frame: ReturnType<typeof measureFigure>) =>
      frame.rows[1].top - frame.rows[0].top;
    expect(pitch(measureFigure(layout, comfortable))).toBe(52);
    expect(pitch(measureFigure(layout, compact))).toBe(34);
    expect(pitch(measureFigure(overlapLayout, comfortable))).toBe(64);
    expect(pitch(measureFigure(overlapLayout, compact))).toBe(40);
  });

  it("measures an empty answer as the ruler, its gap and the bottom pad", () => {
    const empty = layoutCompareRegion([]);
    expect(measureFigure(empty, comfortable)).toEqual({
      rows: [],
      dividers: [],
      height: 46,
    });
    expect(measureFigure(empty, compact).height).toBe(39);
  });
});

describe("glyphBox", () => {
  const roomy = measureFigure(overlapLayout, comfortable).rows[0];
  const tight = measureFigure(overlapLayout, compact).rows[0];

  it("puts a BLAST hit's thin bar at its lane's top", () => {
    const blastFrame = measureFigure(layout, comfortable).rows[0];
    const compactBlastFrame = measureFigure(layout, compact).rows[0];
    const hit = placed({ type: "blast" }, 1);
    expect(glyphBox(comfortable, blastFrame, hit)).toEqual({
      top: 65,
      bottom: 70,
    });
    expect(glyphBox(compact, compactBlastFrame, hit)).toEqual({
      top: 52,
      bottom: 55,
    });
  });

  it("draws a gene its lane's full height: a gene tall in lane 0, the overlap height below", () => {
    expect(glyphBox(comfortable, roomy, placed({ family: 2 }, 0))).toEqual({
      top: 46,
      bottom: 62,
    });
    expect(glyphBox(comfortable, roomy, placed({ family: 2 }, 1))).toEqual({
      top: 66,
      bottom: 82,
    });
    expect(glyphBox(compact, tight, placed({ family: 2 }, 0))).toEqual({
      top: 39,
      bottom: 51,
    });
    expect(glyphBox(compact, tight, placed({ family: 2 }, 1))).toEqual({
      top: 53,
      bottom: 61,
    });
  });

  it("insets a pseudogene by 1 px", () => {
    expect(
      glyphBox(comfortable, roomy, placed({ type: "pseudogene" }, 0)),
    ).toEqual({
      top: 47,
      bottom: 61,
    });
    expect(glyphBox(compact, tight, placed({ type: "pseudogene" }, 1))).toEqual(
      {
        top: 54,
        bottom: 60,
      },
    );
  });

  it("insets an RNA or other feature per density and lane", () => {
    const other = (lane: number) => placed({ type: "tRNA" }, lane);
    expect(glyphBox(comfortable, roomy, other(0))).toEqual({
      top: 50,
      bottom: 58,
    });
    expect(glyphBox(comfortable, roomy, other(1))).toEqual({
      top: 70,
      bottom: 78,
    });
    expect(glyphBox(compact, tight, other(0))).toEqual({ top: 42, bottom: 48 });
    expect(glyphBox(compact, tight, other(1))).toEqual({ top: 55, bottom: 59 });
  });
});

describe("rowAt", () => {
  it("finds the row whose slot holds y, and none above the first or below the last", () => {
    const frame = measureFigure(layout, comfortable);
    expect([29, 30, 83.9, 84, 129.9, 130].map((y) => rowAt(frame, y))).toEqual([
      null,
      0,
      0,
      1,
      1,
      null,
    ]);
  });
});

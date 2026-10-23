import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import {
  constrainToTrack,
  glyphPath,
  glyphShape,
  layoutCompareRegion,
  maxZoom,
} from "../layout";

const identity = {
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
};

describe("layoutCompareRegion", () => {
  it("spans the focus row's window, centered on its pinned gene", () => {
    expect(layoutCompareRegion([focusRow, mirroredRow]).domain).toEqual([
      -1000, 1000,
    ]);
  });

  it("mirrors a row whose homolog runs on the other strand, so homologs line up and point the same way", () => {
    const [focus, mirrored] = layoutCompareRegion([focusRow, mirroredRow]).rows;
    const pinned = (row: typeof focus) =>
      row.features.find((item) => item.feature.fid === row.row.pinnedFid);
    expect(pinned(focus)).toMatchObject({ from: -100, to: 200 });
    expect(pinned(mirrored)).toMatchObject({ from: -100, to: 200 });
  });

  it("drops BLAST hits into the lane below the genes and stacks rows by lane", () => {
    const layout = layoutCompareRegion([focusRow, mirroredRow]);
    const [focus, mirrored] = layout.rows;
    expect(focus.features.map((item) => [item.feature.fid, item.lane])).toEqual([
      ["fig|1.1.peg.1", 0],
      ["fig|1.1.peg.2", 0],
      ["fig|1.1.peg.2.BLAST", 1],
    ]);
    expect(focus.laneCount).toBe(2);
    expect(mirrored.firstLane).toBe(2);
    expect(layout.laneCount).toBe(3);
  });

  it("lets touching features share a lane and moves overlapping ones down", () => {
    const row = {
      ...focusRow,
      features: [
        testGene("fig|1.1.peg.1", 100, 400),
        testGene("fig|1.1.peg.2", 400, 700),
        testGene("fig|1.1.peg.3", 650, 900),
      ],
    };
    const [placed] = layoutCompareRegion([row]).rows;
    expect(placed.features.map((item) => item.lane)).toEqual([0, 0, 1]);
  });

  it("keeps the pinned gene in the first lane and its BLAST hit below it when a neighbor overlaps it", () => {
    // In contig order, as the service sends them: the neighbor comes first.
    const row = {
      ...focusRow,
      features: [
        testGene("fig|1.1.peg.1", 100, 903),
        testGene("fig|1.1.peg.2", 900, 1200),
        testGene("fig|1.1.peg.2.BLAST", 900, 1200, {
          type: "blast",
          strand: null,
        }),
      ],
    };
    const [placed] = layoutCompareRegion([row]).rows;
    expect(placed.features.map((item) => [item.feature.fid, item.lane])).toEqual([
      ["fig|1.1.peg.1", 2],
      ["fig|1.1.peg.2", 0],
      ["fig|1.1.peg.2.BLAST", 1],
    ]);
  });

  it("packs the other features in the service's order, not left to right on screen", () => {
    // Mirrored, so contig order runs right to left: peg.1 is drawn right of
    // peg.2, and the two overlap. Legacy packed peg.1 first.
    const row = {
      ...mirroredRow,
      features: [
        testGene("fig|2.1.peg.1", 4000, 4300),
        testGene("fig|2.1.peg.2", 4200, 4500),
        ...mirroredRow.features,
      ],
    };
    const [, placed] = layoutCompareRegion([focusRow, row]).rows;
    expect(placed.features.map((item) => [item.feature.fid, item.lane])).toEqual([
      ["fig|2.1.peg.1", 0],
      ["fig|2.1.peg.2", 1],
      ["fig|2.1.peg.7", 0],
    ]);
  });

  it("clips the baseline to the contig and marks a contig end inside the window", () => {
    const [focus, mirrored] = layoutCompareRegion([focusRow, mirroredRow]).rows;
    expect(focus).toMatchObject({
      baselineFrom: -1000,
      baselineTo: 1000,
      contigStartShown: false,
      contigEndShown: false,
    });
    // Mirrored: contig position 5500 (its end) lands left of center.
    expect(mirrored).toMatchObject({
      baselineFrom: 1000,
      baselineTo: -500,
      contigStartShown: false,
      contigEndShown: true,
    });
  });

  it("lays out nothing for no rows", () => {
    expect(layoutCompareRegion([])).toEqual({
      rows: [],
      domain: [0, 1],
      laneCount: 0,
    });
  });
});

describe("glyphs", () => {
  it("shapes features as legacy BV-BRC did", () => {
    expect(glyphShape("peg")).toBe("arrow");
    expect(glyphShape("domain_hit")).toBe("arrow");
    expect(glyphShape("blast")).toBe("pill");
    expect(glyphShape("pseudogene")).toBe("bar");
    expect(glyphShape("tRNA")).toBe("box");
  });

  it("draws an arrow with a 15 px head pointing at the 3′ end", () => {
    expect(glyphPath("arrow", 0, 100)).toBe(
      "M 0 -7 L 85 -7 L 85 -10 L 100 0 L 85 10 L 85 7 L 0 7 Z",
    );
    expect(glyphPath("arrow", 100, 0)).toBe(
      "M 100 -7 L 15 -7 L 15 -10 L 0 0 L 15 10 L 15 7 L 100 7 Z",
    );
  });

  it("draws a feature no longer than the head as a triangle", () => {
    expect(glyphPath("arrow", 0, 10)).toBe("M 0 -10 L 10 0 L 0 10 Z");
  });

  it("draws boxes, bars and pills whichever way the feature runs", () => {
    expect(glyphPath("box", 30, 10)).toBe("M 10 -10 h 20 v 20 h -20 Z");
    expect(glyphPath("bar", 10, 30)).toBe("M 10 -5 h 20 v 10 h -20 Z");
    expect(glyphPath("pill", 0, 40)).toBe(
      "M 5 -5 h 30 a 5 5 0 0 1 0 10 h -30 a 5 5 0 0 1 0 -10 Z",
    );
  });

  it("keeps a pill narrower than its height within its width", () => {
    // Elliptical caps: a circular arc would be scaled up to a 10 px circle.
    expect(glyphPath("pill", 0, 4)).toBe(
      "M 2 -5 h 0 a 2 5 0 0 1 0 10 h 0 a 2 5 0 0 1 0 -10 Z",
    );
  });

  it("rounds coordinates to a tenth of a pixel", () => {
    expect(glyphPath("box", 0.123, 10.456)).toBe(
      "M 0.1 -10 h 10.3 v 20 h -10.3 Z",
    );
  });
});

describe("constrainToTrack", () => {
  type Matrix = typeof identity;

  /** What `@visx/zoom`'s `scale` asks for: `matrix` zoomed by `factor` about pixel `x`. */
  const zoomAbout = (matrix: Matrix, factor: number, x: number): Matrix => ({
    ...matrix,
    scaleX: matrix.scaleX * factor,
    translateX: x - (x - matrix.translateX) * factor,
  });

  /** The unscaled position drawn at pixel `x`. */
  const contentAt = (matrix: Matrix, x: number) =>
    (x - matrix.translateX) / matrix.scaleX;

  it("never zooms out past the whole window", () => {
    expect(
      constrainToTrack({ ...identity, scaleX: 0.5, translateX: 40 }, identity, 800),
    ).toEqual(identity);
    const zoomed = { ...identity, scaleX: 2, translateX: -300 };
    expect(constrainToTrack(zoomAbout(zoomed, 0.25, 300), zoomed, 800)).toEqual(
      identity,
    );
  });

  it("caps the zoom and keeps the window's ends on screen", () => {
    expect(
      constrainToTrack({ ...identity, scaleX: 100, translateX: 50 }, identity, 800),
    ).toMatchObject({ scaleX: maxZoom, translateX: 0 });
    expect(
      constrainToTrack({ ...identity, scaleX: 2, translateX: -5000 }, identity, 800),
    ).toMatchObject({ scaleX: 2, translateX: -800 });
  });

  it("holds the content under the zoom point still at the zoom cap", () => {
    const atCap = { ...identity, scaleX: maxZoom, translateX: -4000 };
    expect(constrainToTrack(zoomAbout(atCap, 1.5, 300), atCap, 800)).toEqual(
      atCap,
    );

    const nearCap = { ...identity, scaleX: 16, translateX: -3000 };
    const capped = constrainToTrack(zoomAbout(nearCap, 1.5, 400), nearCap, 800);
    expect(capped).toMatchObject({ scaleX: maxZoom, translateX: -3850 });
    expect(contentAt(capped, 400)).toBe(contentAt(nearCap, 400));
  });

  it("ignores vertical scale and pan", () => {
    expect(
      constrainToTrack(
        { ...identity, scaleX: 2, scaleY: 3, translateX: -100, translateY: 40 },
        identity,
        800,
      ),
    ).toEqual({ ...identity, scaleX: 2, translateX: -100 });
  });
});

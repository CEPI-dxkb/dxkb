import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import { constrainToTrack, layoutCompareRegion, maxZoom } from "../layout";

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

  it("hands back the matrix it was given when nothing moves", () => {
    // A drag at 1× (the whole window in view) and one against the window's end.
    expect(
      constrainToTrack({ ...identity, translateX: 40 }, identity, 800),
    ).toBe(identity);
    const atEnd = { ...identity, scaleX: 2, translateX: -800 };
    expect(
      constrainToTrack({ ...atEnd, translateX: -900 }, atEnd, 800),
    ).toBe(atEnd);
    // A zoom past the cap, about the point already under it.
    const atCap = { ...identity, scaleX: maxZoom, translateX: -4000 };
    expect(constrainToTrack({ ...atCap, scaleX: 30 }, atCap, 800)).toBe(atCap);
    // A pan that moves is a new matrix.
    const moved = constrainToTrack({ ...atEnd, translateX: -700 }, atEnd, 800);
    expect(moved).not.toBe(atEnd);
    expect(moved).toMatchObject({ scaleX: 2, translateX: -700 });
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

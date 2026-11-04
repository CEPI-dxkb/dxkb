import { keepSequences, parseUserTrack, userScoreScale } from "../user-track";

describe("parseUserTrack", () => {
  it("reads tiles from accession, start and end, skipping unreadable lines", () => {
    const parsed = parseUserTrack(
      "accession\tstart\tend\nNC_000962\t2052\t3260\r\nNC_000962\t34\t1524\n\nbad line",
      "tiles",
    );
    expect(parsed.items).toEqual([
      { accession: "NC_000962", start: 34, end: 1524, score: null },
      { accession: "NC_000962", start: 2052, end: 3260, score: null },
    ]);
    expect(parsed.skipped).toBe(2);
  });

  it("needs a score for a line, histogram or heatmap", () => {
    const parsed = parseUserTrack("A\t1\t10\nA\t11\t20\t0.5\nA\t21\t30\tNaN", "histogram");
    expect(parsed.items).toEqual([{ accession: "A", start: 11, end: 20, score: 0.5 }]);
    expect(parsed.skipped).toBe(2);
  });

  it("drops a row whose end precedes its start", () => {
    expect(parseUserTrack("A\t20\t10\t1", "line").items).toEqual([]);
  });

  it("skips a row whose number does not fill its cell, rather than reading its start", () => {
    const parsed = parseUserTrack(
      "A\t1e3\t2000\t1\nA\t10x\t20\t1\nA\t1\t20kb\t1\nA\t1\t10\t0.5junk\nA\t5\t9\t1",
      "line",
    );
    expect(parsed.items).toEqual([{ accession: "A", start: 5, end: 9, score: 1 }]);
    expect(parsed.skipped).toBe(4);
  });

  it("reads coordinates only as safe whole numbers from 1", () => {
    const parsed = parseUserTrack(
      "A\t-5\t10\nA\t0\t10\nA\t1.5\t10\nA\t+1\t10\nA\t1\t9007199254740993\nA\t 1 \t10 ",
      "tiles",
    );
    expect(parsed.items).toEqual([{ accession: "A", start: 1, end: 10, score: null }]);
    expect(parsed.skipped).toBe(5);
  });

  it("reads a score written as any decimal, but not hex, infinity or an empty cell", () => {
    const parsed = parseUserTrack(
      "A\t1\t2\t 2.5e-1 \nA\t3\t4\t-.5\nA\t5\t6\t+3\nA\t7\t8\t0x10\nA\t9\t10\tInfinity\nA\t11\t12\t",
      "histogram",
    );
    expect(parsed.items.map((item) => item.score)).toEqual([0.25, -0.5, 3]);
    expect(parsed.skipped).toBe(3);
  });

  it("normalizes the score range as legacy did", () => {
    expect(parseUserTrack("A\t1\t2\t0.2\nA\t3\t4\t0.8", "line").scale).toEqual({ min: 0, max: 1 });
  });
});

describe("userScoreScale", () => {
  it.each([
    [0, 0.8, { min: 0, max: 1 }],
    [-0.5, 0.9, { min: -1, max: 1 }],
    [0, 7, { min: 0, max: 7 }],
    [-3, 2, { min: -3, max: 3 }],
    [-5, 0, { min: -5, max: 5 }],
  ])("reads [%f, %f] as %o", (min, max, scale) => {
    expect(userScoreScale(min, max)).toEqual(scale);
  });
});

describe("keepSequences", () => {
  const lengths = new Map([["A", 1000], ["B", 500]]);

  it("drops rows off the drawn sequences and rescales without them", () => {
    const parsed = parseUserTrack("A\t1\t10\t0.5\nZ\t1\t10\t40\nbad", "line");
    expect(parsed.scale).toEqual({ min: 0, max: 40 });
    expect(keepSequences(parsed, lengths)).toEqual({
      parsed: { items: [{ accession: "A", start: 1, end: 10, score: 0.5 }], scale: { min: 0, max: 1 }, skipped: 1 },
      offSequence: 1,
      pastEnd: 0,
    });
  });

  it("returns the parse unchanged when every row is on a drawn sequence", () => {
    const parsed = parseUserTrack("A\t1\t10\nB\t5\t9", "tiles");
    const kept = keepSequences(parsed, lengths);
    expect(kept).toMatchObject({ offSequence: 0, pastEnd: 0 });
    expect(kept.parsed).toBe(parsed);
  });

  it("can drop every row", () => {
    const kept = keepSequences(parseUserTrack("Z\t1\t10", "tiles"), lengths);
    expect(kept.parsed.items).toEqual([]);
    expect(kept.offSequence).toBe(1);
  });

  it("drops a row that starts past the sequence's end and counts it apart", () => {
    const kept = keepSequences(parseUserTrack("A\t5000\t6000\nA\t1\t10\nZ\t1\t10", "tiles"), lengths);
    expect(kept.parsed.items).toEqual([{ accession: "A", start: 1, end: 10, score: null }]);
    expect(kept).toMatchObject({ offSequence: 1, pastEnd: 1 });
  });

  it("keeps rows that overlap or touch the end and drops one starting just past it", () => {
    const kept = keepSequences(parseUserTrack("A\t900\t1500\nA\t1000\t1000\nA\t1001\t1001", "tiles"), lengths);
    expect(kept.parsed.items.map((item) => [item.start, item.end])).toEqual([[900, 1500], [1000, 1000]]);
    expect(kept.pastEnd).toBe(1);
  });

  it("rescales without a dropped high score", () => {
    const parsed = parseUserTrack("A\t1\t10\t0.5\nA\t5000\t6000\t40", "histogram");
    expect(parsed.scale).toEqual({ min: 0, max: 40 });
    expect(keepSequences(parsed, lengths).parsed.scale).toEqual({ min: 0, max: 1 });
  });
});

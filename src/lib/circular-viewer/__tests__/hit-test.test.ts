import { indexSpans, spanAt, visibleSegments, type SpanIndex } from "../hit-test";

const index = indexSpans([
  { startAngle: 2, endAngle: 3, index: 1 },
  { startAngle: 0, endAngle: 1, index: 0 },
  { startAngle: 2.5, endAngle: 2.6, index: 2 },
]);

describe("spanAt", () => {
  it("finds the span under the angle, preferring the one that starts last", () => {
    expect(spanAt(index, 0.5, 0)?.index).toBe(0);
    expect(spanAt(index, 2.55, 0)?.index).toBe(2);
    expect(spanAt(index, 2.8, 0)?.index).toBe(1);
  });

  it("reaches a sub-pixel span within the tolerance and nothing beyond it", () => {
    expect(spanAt(index, 1.05, 0.1)?.index).toBe(0);
    expect(spanAt(index, 1.5, 0.1)).toBeUndefined();
  });

  it("prefers the shorter of two spans that share a start", () => {
    const shared = indexSpans([
      { startAngle: 1, endAngle: 1.2, index: 1 },
      { startAngle: 1, endAngle: 2, index: 0 },
    ]);
    expect(spanAt(shared, 1.1, 0)?.index).toBe(1);
    expect(spanAt(shared, 1.5, 0)?.index).toBe(0);
  });

  it("answers nothing for an empty track", () => {
    expect(spanAt(indexSpans([]), 1, 1)).toBeUndefined();
  });

  describe("across the 12 o'clock seam", () => {
    const tolerance = 0.003;
    const fullTurn = 2 * Math.PI;

    it("finds a span at the start of the circle from just before 12 o'clock", () => {
      const start = indexSpans([{ startAngle: 0, endAngle: 0.001, index: 7 }]);
      expect(spanAt(start, fullTurn - 0.0005, tolerance)?.index).toBe(7);
      expect(spanAt(start, fullTurn - 0.005, tolerance)).toBeUndefined();
    });

    it("finds a span at the end of the circle from just after 12 o'clock", () => {
      const end = indexSpans([{ startAngle: fullTurn - 0.01, endAngle: fullTurn - 0.002, index: 8 }]);
      expect(spanAt(end, 0.0005, tolerance)?.index).toBe(8);
      expect(spanAt(end, 0.002, tolerance)).toBeUndefined();
    });
  });
});

describe("visibleSegments", () => {
  /** Each piece's span is the one `spanAt` names at the piece's middle. */
  const namedBySpanAt = (index: SpanIndex) =>
    visibleSegments(index).every(
      (segment) => spanAt(index, (segment.startAngle + segment.endAngle) / 2, 0)?.index === segment.index,
    );

  it("lets a nested span show through, and the outer one resume after it", () => {
    // Rows 1..400, 101..200 and 101..150 as 0-based offsets over 100: the
    // last two share a start, so the shorter is on top.
    const nested = indexSpans([
      { startAngle: 0, endAngle: 4, index: 0 },
      { startAngle: 1, endAngle: 2, index: 1 },
      { startAngle: 1, endAngle: 1.5, index: 2 },
    ]);
    expect(visibleSegments(nested)).toEqual([
      { index: 0, startAngle: 0, endAngle: 1 },
      { index: 2, startAngle: 1, endAngle: 1.5 },
      { index: 1, startAngle: 1.5, endAngle: 2 },
      { index: 0, startAngle: 2, endAngle: 4 },
    ]);
    expect(namedBySpanAt(nested)).toBe(true);
  });

  it("shows the later of two identical spans, as hover names it, and drops a span buried to its end", () => {
    const stacked = indexSpans([
      { startAngle: 0, endAngle: 1, index: 0 },
      { startAngle: 0, endAngle: 1, index: 1 },
      { startAngle: 2, endAngle: 3, index: 2 },
      { startAngle: 2.2, endAngle: 2.4, index: 3 },
      { startAngle: 2.5, endAngle: 3, index: 4 },
    ]);
    expect(visibleSegments(stacked)).toEqual([
      { index: 1, startAngle: 0, endAngle: 1 },
      { index: 2, startAngle: 2, endAngle: 2.2 },
      { index: 3, startAngle: 2.2, endAngle: 2.4 },
      { index: 2, startAngle: 2.4, endAngle: 2.5 },
      { index: 4, startAngle: 2.5, endAngle: 3 },
    ]);
    expect(namedBySpanAt(stacked)).toBe(true);
  });

  it("is empty for an empty track", () => {
    expect(visibleSegments(indexSpans([]))).toEqual([]);
  });
});

import {
  buildGenomeLayout,
  contigGapRadians,
  figureRadius,
  layoutRings,
  offsetAngle,
  toCartesian,
  toPolar,
} from "../layout";

describe("buildGenomeLayout", () => {
  it("starts at 12 o'clock and leaves legacy's 0.3° gap after a single sequence", () => {
    const layout = buildGenomeLayout([{ accession: "A", length: 1000 }]);
    expect(layout.contigs[0].startAngle).toBe(0);
    expect(layout.contigs[0].endAngle).toBeCloseTo(2 * Math.PI - contigGapRadians);
  });

  it("sizes sequences by length with a gap between them", () => {
    const layout = buildGenomeLayout([
      { accession: "A", length: 3000 },
      { accession: "B", length: 1000 },
    ]);
    const [a, b] = layout.contigs;
    expect((a.endAngle - a.startAngle) / (b.endAngle - b.startAngle)).toBeCloseTo(3);
    expect(b.startAngle - a.endAngle).toBeCloseTo(contigGapRadians);
  });

  it("caps the gaps at a tenth of the circle for a fragmented draft", () => {
    const layout = buildGenomeLayout(
      Array.from({ length: 1000 }, (_, index) => ({ accession: `C${String(index)}`, length: 100 })),
    );
    const drawn = layout.contigs.reduce((sum, c) => sum + (c.endAngle - c.startAngle), 0);
    expect(2 * Math.PI - drawn).toBeCloseTo(0.2 * Math.PI);
  });

  it("drops empty sequences and answers undefined for an unknown accession", () => {
    const layout = buildGenomeLayout([{ accession: "A", length: 0 }, { accession: "B", length: 10 }]);
    expect(layout.contigs.map((c) => c.accession)).toEqual(["B"]);
    expect(offsetAngle(layout, "A", 5)).toBeUndefined();
    expect(offsetAngle(layout, "B", 99)).toBeCloseTo(layout.contigs[0].endAngle);
  });
});

describe("layoutRings", () => {
  it("stacks rings inward from the edge, 4 px apart, as legacy Viewer.addTrack did", () => {
    const rings = layoutRings([{ id: "labels", widthFraction: 0.1 }, { id: "contigs", widthFraction: 0.03 }], 300);
    expect(rings.map((ring) => [ring.id, ring.innerRadius, ring.outerRadius])).toEqual([
      ["labels", expect.closeTo(266), expect.closeTo(296)],
      ["contigs", expect.closeTo(253), expect.closeTo(262)],
    ]);
  });

  it("narrows rings rather than crossing the center", () => {
    const rings = layoutRings(Array.from({ length: 20 }, (_, i) => ({ id: String(i), widthFraction: 0.1 })), 300);
    expect(rings.at(-1)?.innerRadius).toBeCloseTo(36);
  });

  it.each([
    [50, 20],
    [15, 11],
    [100, 30],
  ])("keeps every ring of a %d px figure with %d tracks outside the center, in order", (radius, count) => {
    const rings = layoutRings(Array.from({ length: count }, (_, i) => ({ id: String(i), widthFraction: 0.1 })), radius);
    let edge = radius;
    for (const ring of rings) {
      expect(ring.innerRadius).toBeGreaterThanOrEqual(0);
      expect(ring.outerRadius).toBeGreaterThan(ring.innerRadius);
      expect(ring.outerRadius).toBeLessThanOrEqual(edge);
      edge = ring.innerRadius;
    }
    expect(rings.at(-1)?.innerRadius).toBeCloseTo(radius * 0.12);
  });

  it("draws nothing at a zero radius", () => {
    const rings = layoutRings([{ id: "a", widthFraction: 0.1 }, { id: "b", widthFraction: 0.05 }], 0);
    expect(rings.map((ring) => [ring.innerRadius, ring.outerRadius])).toEqual([[0, 0], [0, 0]]);
  });
});

describe("polar math", () => {
  it.each([
    [0, -10, 0],
    [10, 0, Math.PI / 2],
    [0, 10, Math.PI],
    [-10, 0, (3 * Math.PI) / 2],
  ])("(%d, %d) is at %f rad", (dx, dy, angle) => {
    expect(toPolar(dx, dy).angle).toBeCloseTo(angle);
    const back = toCartesian(angle, 10);
    expect(back.x).toBeCloseTo(dx);
    expect(back.y).toBeCloseTo(dy);
  });

  it("keeps 7.5 px inside the smaller side", () => {
    expect(figureRadius(615, 800)).toBe(300);
    expect(figureRadius(0, 0)).toBe(0);
  });
});

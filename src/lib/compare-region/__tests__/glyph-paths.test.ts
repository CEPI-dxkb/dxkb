import { densitySpecs } from "../density";
import { arrowPath, barPath, glyphPath, roundPx } from "../glyph-paths";

const { comfortable, compact } = densitySpecs;

describe("glyphPath", () => {
  it("draws a gene as a rounded pentagon pointing to its 3′ end", () => {
    expect(glyphPath(comfortable, "gene", 0, 100, 0, 16)).toBe(
      "M0,2.5Q0,0 2.5,0L91,0Q93,0 94.3,1.5L99.2,7.1Q100,8 99.2,8.9L94.3,14.5Q93,16 91,16L2.5,16Q0,16 0,13.5Z",
    );
  });

  it("points a reversed gene left", () => {
    expect(glyphPath(comfortable, "gene", 100, 0, 0, 16)).toBe(
      "M100,2.5Q100,0 97.5,0L9,0Q7,0 5.7,1.5L0.8,7.1Q0,8 0.8,8.9L5.7,14.5Q7,16 9,16L97.5,16Q100,16 100,13.5Z",
    );
  });

  it("draws a gene shorter than its head as a rounded triangle", () => {
    expect(glyphPath(comfortable, "gene", 0, 6, 0, 16)).toBe(
      "M0,1.5Q0,0 0.9,1.2L5.4,7.2Q6,8 5.4,8.8L0.9,14.8Q0,16 0,14.5Z",
    );
  });

  it("draws an orphan and a pseudogene with the gene's outline", () => {
    const gene = glyphPath(comfortable, "gene", 0, 100, 0, 16);
    expect(glyphPath(comfortable, "orphan", 0, 100, 0, 16)).toBe(gene);
    expect(glyphPath(comfortable, "pseudo", 0, 100, 0, 16)).toBe(gene);
  });

  it("uses Compact's shorter head and tighter corners", () => {
    expect(glyphPath(compact, "gene", 0, 100, 0, 12)).toBe(
      "M0,2Q0,0 2,0L93,0Q94.5,0 95.5,1.1L99.3,5.3Q100,6 99.3,6.7L95.5,10.9Q94.5,12 93,12L2,12Q0,12 0,10Z",
    );
  });

  it("draws a BLAST hit as a pill", () => {
    expect(glyphPath(comfortable, "blast", 0, 40, 0, 5)).toBe(
      "M2.5,0H37.5Q40,0 40,2.5V2.5Q40,5 37.5,5H2.5Q0,5 0,2.5V2.5Q0,0 2.5,0Z",
    );
  });

  it("draws another feature as a bar with the density's corner radius", () => {
    expect(glyphPath(comfortable, "other", 30, 10, 4, 12)).toBe(
      "M12,4H28Q30,4 30,6V10Q30,12 28,12H12Q10,12 10,10V6Q10,4 12,4Z",
    );
    expect(glyphPath(compact, "other", 30, 10, 4, 12)).toBe(
      barPath(30, 10, 4, 8, compact.otherRadius),
    );
  });
});

describe("arrowPath", () => {
  it("is the gene outline, so the legend can draw a Comfortable arrow", () => {
    expect(arrowPath(comfortable, 0, 100, 0, 16)).toBe(
      glyphPath(comfortable, "gene", 0, 100, 0, 16),
    );
  });
});

describe("barPath", () => {
  it("draws a zero-width bar 1 px wide", () => {
    expect(barPath(5, 5, 0, 4, 2)).toBe(
      "M5.5,0H5.5Q6,0 6,0.5V3.5Q6,4 5.5,4H5.5Q5,4 5,3.5V0.5Q5,0 5.5,0Z",
    );
  });
});

describe("roundPx", () => {
  it("rounds to a tenth of a pixel", () => {
    expect([94.2857, 0.05, -3.04, 12].map(roundPx)).toEqual([
      "94.3",
      "0.1",
      "-3",
      "12",
    ]);
  });
});

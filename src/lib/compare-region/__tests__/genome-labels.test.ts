import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import {
  formatBp,
  formatLocation,
  noProduct,
  oneLineGenomeName,
  rowIdentity,
  rowTagText,
  splitGenomeName,
} from "../genome-labels";
import { layoutCompareRegion } from "../layout";
import { estimateTextWidth } from "../text-measure";

describe("splitGenomeName", () => {
  it.each([
    [
      "Brucella suis bv. 1 str. S2",
      { binomial: "Brucella suis", rest: "bv. 1 str. S2" },
    ],
    [
      "Escherichia coli str. K-12 substr. MG1655",
      { binomial: "Escherichia coli", rest: "str. K-12 substr. MG1655" },
    ],
    ["Salmonella enterica", { binomial: "Salmonella enterica", rest: "" }],
    ["Streptococcus sp. 1", { binomial: "Streptococcus sp.", rest: "1" }],
    [
      "Middle East respiratory syndrome-related coronavirus",
      {
        binomial: "Middle",
        rest: "East respiratory syndrome-related coronavirus",
      },
    ],
  ])("splits %s", (name, expected) => {
    expect(splitGenomeName(name)).toEqual(expected);
  });
});

describe("oneLineGenomeName", () => {
  // Species: 6.16 px a character; strain: 5.6 px; a 4 px gap between them.
  const line = (name: string, room: number) =>
    oneLineGenomeName(name, room, estimateTextWidth);
  const ecoli = "Escherichia coli str. K-12 substr. MG1655";

  it("shows the species and the strain when both fit", () => {
    expect(line(ecoli, 300)).toEqual({
      binomial: "Escherichia coli",
      rest: "str. K-12 substr. MG1655",
    });
    expect(line("Salmonella enterica", 300)).toEqual({
      binomial: "Salmonella enterica",
      rest: "",
    });
  });

  it("gives the species the room first, then cuts the strain", () => {
    expect(line(ecoli, 150)).toEqual({
      binomial: "Escherichia coli",
      rest: "str. K-…",
    });
  });

  it("leaves an ellipsis for a strain that has no room, when one fits", () => {
    expect(line(ecoli, 110)).toEqual({
      binomial: "Escherichia coli",
      rest: "…",
    });
    expect(line(ecoli, 100)).toEqual({
      binomial: "Escherichia coli",
      rest: "",
    });
  });

  it("drops the strain when the species itself is cut", () => {
    expect(line(ecoli, 50)).toEqual({ binomial: "Escheri…", rest: "" });
  });
});

describe("rowIdentity", () => {
  it("is the pinned gene's identity to the focus gene", () => {
    const layout = layoutCompareRegion([focusRow, mirroredRow]);
    expect(rowIdentity(layout, 0)).toBe(100);
    expect(rowIdentity(layout, 1)).toBe(80);
    expect(rowIdentity(layout, 2)).toBeNull();
  });

  it("falls back to the BLAST hit's identity, then to none", () => {
    const hitOnly = {
      ...focusRow,
      features: [
        testGene("fig|1.1.peg.2", 900, 1200, { family: 1 }),
        testGene("fig|1.1.peg.2.BLAST", 900, 1200, {
          type: "blast",
          strand: null,
          identity: 70,
        }),
      ],
    };
    const neither = {
      ...focusRow,
      features: [testGene("fig|1.1.peg.2", 900, 1200, { family: 1 })],
    };
    const layout = layoutCompareRegion([hitOnly, neither]);
    expect(rowIdentity(layout, 0)).toBe(70);
    expect(rowIdentity(layout, 1)).toBeNull();
  });
});

describe("formatLocation", () => {
  it("gives the 5′ and 3′ ends, the length and the strand", () => {
    expect(formatLocation(testGene("fig|1.1.peg.1", 900, 1200))).toBe(
      "900…1,200 (301 bp, +)",
    );
    expect(formatLocation(testGene("fig|1.1.peg.1", 5100, 4800))).toBe(
      "5,100…4,800 (301 bp, -)",
    );
    expect(
      formatLocation(testGene("fig|1.1.peg.1", 900, 1200, { strand: null })),
    ).toBe("900…1,200 (301 bp)");
  });
});

describe("small labels", () => {
  it("formats base pairs with thousands separators", () => {
    expect(formatBp(1200)).toBe("1,200");
    expect(formatBp(5)).toBe("5");
  });

  it("numbers rows from 01", () => {
    expect(rowTagText(0)).toBe("01");
    expect(rowTagText(9)).toBe("10");
    expect(rowTagText(99)).toBe("100");
  });

  it("names a feature with no product", () => {
    expect(noProduct).toBe("No product");
  });
});

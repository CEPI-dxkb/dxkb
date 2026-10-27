import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import { densitySpecs } from "../density";
import { measureFigure } from "../figure-frame";
import {
  capHeight,
  centeredBaseline,
  formatBp,
  formatLocation,
  genomeLabelLines,
  noProduct,
  rowIdentity,
  rowTagText,
  splitGenomeName,
} from "../genome-labels";
import { layoutCompareRegion } from "../layout";

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

describe("genomeLabelLines", () => {
  const layout = layoutCompareRegion([focusRow, mirroredRow]);

  it.each(["comfortable", "compact"] as const)(
    "centers a two-line label's ink in its row's slot, in %s",
    (density) => {
      const spec = densitySpecs[density];
      for (const row of measureFigure(layout, spec).rows) {
        const lines = genomeLabelLines(spec, row, true);
        // The ink: the tag or the species' caps, down to the strain's baseline.
        const inkTop =
          lines.middle -
          Math.max(spec.tagHeight / 2, (capHeight * spec.speciesSize) / 2);
        expect(inkTop - row.slotTop).toBeCloseTo(
          row.slotBottom - lines.strainBaseline,
          6,
        );
        expect(lines.strainBaseline - lines.speciesBaseline).toBeCloseTo(
          spec.lineGap,
          6,
        );
      }
    },
  );

  it("centers a species alone on the slot's middle", () => {
    const spec = densitySpecs.comfortable;
    const row = measureFigure(layout, spec).rows[1];
    expect(genomeLabelLines(spec, row, false).middle).toBe(
      (row.slotTop + row.slotBottom) / 2,
    );
  });

  it("puts the species' caps, the tag and the identity on one middle", () => {
    const spec = densitySpecs.compact;
    const lines = genomeLabelLines(
      spec,
      measureFigure(layout, spec).rows[1],
      true,
    );
    expect(lines.speciesBaseline - (capHeight * spec.speciesSize) / 2).toBe(
      lines.middle,
    );
    expect(
      centeredBaseline(lines.middle, spec.identitySize) -
        (capHeight * spec.identitySize) / 2,
    ).toBe(lines.middle);
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

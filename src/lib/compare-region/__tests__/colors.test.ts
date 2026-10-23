import { testGene } from "@/test-helpers/compare-region";
import {
  compareRegionPalette,
  familyFill,
  featureFill,
  identityFill,
  noFamilyFill,
} from "../colors";

describe("Compare Region colors", () => {
  it("has the service's 49-color palette", () => {
    expect(compareRegionPalette).toHaveLength(49);
    expect(compareRegionPalette[0]).toBe("rgb(255, 0, 0)");
  });

  it("colors set 1 (the focus gene's family) with the first color, as legacy did", () => {
    expect(familyFill(1)).toBe("rgb(255, 0, 0)");
    // Set 2 is palette entry 2: legacy remaps only set 1 (entry 1 goes unused).
    expect(familyFill(2)).toBe("rgb(50, 255, 50)");
    expect(familyFill(3)).toBe("rgb(224, 133, 15)");
  });

  it("shades sets that wrap past the palette: lighter, then darker", () => {
    expect(familyFill(49)).toBe("rgb(255, 115, 115)");
    expect(familyFill(98)).toBe("rgb(166, 0, 0)");
  });

  it("colors BLAST identity as red at that saturation", () => {
    expect(identityFill(100)).toBe("rgb(255, 0, 0)");
    expect(identityFill(80)).toBe("rgb(255, 51, 51)");
    expect(identityFill(0)).toBe("rgb(255, 255, 255)");
  });

  it("fills hits and the pinned gene by identity, other genes by family", () => {
    const pinned = testGene("fig|1.1.peg.2", 1, 2, { family: 4, identity: 80 });
    expect(featureFill(pinned, "fig|1.1.peg.2")).toBe("rgb(255, 51, 51)");
    expect(featureFill(pinned, "fig|1.1.peg.9")).toBe(familyFill(4));
    const hit = testGene("fig|1.1.peg.2.BLAST", 1, 2, { type: "blast", identity: 100 });
    expect(featureFill(hit, "fig|1.1.peg.2")).toBe("rgb(255, 0, 0)");
    expect(featureFill(testGene("fig|1.1.peg.3", 1, 2), "fig|1.1.peg.2")).toBe(
      noFamilyFill,
    );
  });
});

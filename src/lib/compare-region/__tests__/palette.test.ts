import { focusRow, testGene } from "@/test-helpers/compare-region";
import {
  deepen,
  familyColor,
  featurePaint,
  focusFamilyColor,
  focusInk,
  identityColor,
  labelInk,
} from "../colors";

const focusHue = 37.18;

/** Degrees between two hues, the short way round. */
function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

function hueOf(color: string): number {
  const match = /^oklch\(\S+ \S+ ([\d.]+)\)$/.exec(color);
  if (!match) throw new Error(`Not an opaque OKLCH color: ${color}`);
  return Number(match[1]);
}

describe("familyColor", () => {
  it("gives the focus gene's family the brand orange", () => {
    expect(focusFamilyColor).toBe("oklch(71.57% 0.182 37.18)");
    expect(familyColor(1)).toBe(focusFamilyColor);
  });

  it("steps the other families round the hue circle in three lightness tiers", () => {
    expect(familyColor(2)).toBe("oklch(0.73 0.12 212.0)");
    expect(familyColor(3)).toBe("oklch(0.645 0.11 349.5)");
    expect(familyColor(4)).toBe("oklch(0.8 0.095 127.0)");
  });

  it("moves a hue near the focus orange 66° on", () => {
    // Raw hues 42.0, 9.6 and 62.1 all sit within 32° of the orange.
    expect(familyColor(6)).toBe("oklch(0.645 0.11 108.0)");
    expect(familyColor(11)).toBe("oklch(0.73 0.12 75.6)");
    expect(familyColor(14)).toBe("oklch(0.73 0.12 128.1)");
  });

  it("gives an out-of-range family number a valid color", () => {
    for (const family of [0, -1, -2, -7]) {
      const color = familyColor(family);
      expect(color).toMatch(/^oklch\(0\.\d+ 0\.\d+ \d+\.\d\)$/);
      expect(color).not.toMatch(/undefined|NaN/);
      expect(hueOf(color)).toBeGreaterThanOrEqual(0);
      expect(hueOf(color)).toBeLessThan(360);
    }
  });

  it("keeps every other family at least 32° from the focus orange", () => {
    for (let family = 2; family <= 500; family += 1) {
      expect(
        hueGap(hueOf(familyColor(family)), focusHue),
      ).toBeGreaterThanOrEqual(32);
    }
  });
});

describe("identityColor", () => {
  it.each([
    [0, "0.16"],
    [-5, "0.16"],
    [30, "0.41"],
    [65, "0.71"],
    [80, "0.83"],
    [100, "1.00"],
    [150, "1.00"],
  ])("paints identity %i as the orange at alpha %s", (identity, alpha) => {
    expect(identityColor(identity)).toBe(
      `oklch(71.57% 0.182 37.18 / ${alpha})`,
    );
  });
});

describe("deepen", () => {
  it("darkens an OKLCH color by 0.2 lightness, percent or not", () => {
    expect(deepen("oklch(71.57% 0.182 37.18)")).toBe(
      "oklch(0.516 0.182 37.18)",
    );
    expect(deepen("oklch(0.73 0.12 212.0)")).toBe("oklch(0.530 0.12 212.0)");
  });

  it("leaves any other color as it is", () => {
    expect(deepen("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(deepen("oklch(71.57% 0.182 37.18 / 0.41)")).toBe(
      "oklch(71.57% 0.182 37.18 / 0.41)",
    );
  });
});

describe("focusInk", () => {
  it("is the focus orange 20 points darker, which reads as text on a light card", () => {
    expect(focusInk).toBe("oklch(51.57% 0.182 37.18)");
  });
});

describe("labelInk", () => {
  it("is a dark ink that reads on every family fill", () => {
    expect(labelInk).toBe("oklch(0.25 0.03 265)");
  });
});

describe("featurePaint", () => {
  it("paints a BLAST hit by its identity", () => {
    const hit = testGene("fig|1.1.peg.2.BLAST", 1, 2, {
      type: "blast",
      identity: 80,
    });
    expect(featurePaint(hit)).toBe(identityColor(80));
    expect(featurePaint({ ...hit, identity: null })).toBe(identityColor(0));
  });

  it("paints a gene by its family, the pinned gene included", () => {
    const [upstream, pinned] = focusRow.features;
    expect(featurePaint(upstream)).toBe(familyColor(3));
    // Unlike the legacy fill, the pinned gene is not painted by identity.
    expect(pinned.identity).toBe(100);
    expect(featurePaint(pinned)).toBe(focusFamilyColor);
  });

  it("leaves a feature without a family unpainted", () => {
    expect(featurePaint(testGene("fig|1.1.peg.3", 1, 2))).toBeUndefined();
  });
});

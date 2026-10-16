import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  geoNoDataFill,
  geoStepFills,
  isUsaTopoName,
  lookupCountryCount,
  makeGeoColorScale,
  resolveCountryDataKey,
} from "@/components/organisms/geo-distribution/color-scale";

describe("makeGeoColorScale", () => {
  // Shaped like Influenza A's US states: fifty with 5K–115K genomes and one
  // with 8, which a log ramp from 1 squeezed into a fifth of its colors.
  const states = [
    8,
    ...Array.from({ length: 50 }, (_, index) => 5000 + index * 2200),
  ];

  it("fills a region without genomes as no data", () => {
    const scale = makeGeoColorScale(states);
    expect(scale.fill(0)).toBe(geoNoDataFill);
    expect(scale.fill(-5)).toBe(geoNoDataFill);
    expect(scale.fill(Number.NaN)).toBe(geoNoDataFill);
  });

  it("has no steps for a view without data", () => {
    const scale = makeGeoColorScale([0, 0]);
    expect(scale.steps).toEqual([]);
    expect(scale.max).toBe(0);
    expect(scale.fill(10)).toBe(geoNoDataFill);
  });

  it("uses all seven steps, bounded at rounded quantiles of the counts", () => {
    const scale = makeGeoColorScale(states);

    expect(scale.steps).toEqual(
      [8, 19000, 34000, 50000, 66000, 81000, 97000].map(
        (from, index) => ({ from, fill: geoStepFills[index] }),
      ),
    );
    expect(scale.max).toBe(112800);
  });

  it("puts about as many regions in each step", () => {
    const scale = makeGeoColorScale(states);
    const perStep = geoStepFills.map(
      (fill) => states.filter((count) => scale.fill(count) === fill).length,
    );
    expect(Math.max(...perStep) - Math.min(...perStep)).toBeLessThanOrEqual(1);
  });

  it("starts a step at its bound", () => {
    const scale = makeGeoColorScale(states);
    expect(scale.fill(18999)).toBe(geoStepFills[0]);
    expect(scale.fill(19000)).toBe(geoStepFills[1]);
    expect(scale.fill(1_000_000)).toBe(geoStepFills[6]);
  });

  it("spreads fewer distinct counts across the ramp, darkest for the most", () => {
    expect(makeGeoColorScale([3, 3, 3]).steps).toEqual([
      { from: 3, fill: geoStepFills[6] },
    ]);
    // Every quantile below the top one is 1, so two steps: lightest and darkest.
    expect(makeGeoColorScale([1, 1, 1, 1, 100]).steps).toEqual([
      { from: 1, fill: geoStepFills[0] },
      { from: 43, fill: geoStepFills[6] },
    ]);
  });
});

describe("the map's color ramps in globals.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  function ramp(selector: string): { lightness: number; chroma: number }[] {
    const start = css.indexOf(`${selector} {`);
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf("}", start));
    return [...block.matchAll(/--geo-step-\d: oklch\(([\d.]+) ([\d.]+) [\d.]+\)/g)].map(
      ([, lightness, chroma]) => ({
        lightness: Number(lightness),
        chroma: Number(chroma),
      }),
    );
  }

  it.each(["bacteria", "viruses", "fungi", "all"])(
    "steps %s's lightness evenly one way in each theme",
    (accent) => {
      const light = ramp(`[data-geo-accent="${accent}"]`);
      const dark = ramp(`[data-theme$="-dark"] [data-geo-accent="${accent}"]`);
      expect(light).toHaveLength(geoStepFills.length);
      expect(dark).toHaveLength(geoStepFills.length);
      for (let index = 1; index < geoStepFills.length; index += 1) {
        // Light to dark on a light theme; dark to light on a dark one.
        expect(light[index - 1].lightness - light[index].lightness).toBeCloseTo(0.09);
        expect(dark[index].lightness - dark[index - 1].lightness).toBeCloseTo(0.09);
      }
    },
  );

  it("keeps no data a neutral gray in each theme", () => {
    for (const selector of ["[data-geo-accent]", '[data-theme$="-dark"] [data-geo-accent]']) {
      const start = css.indexOf(`${selector} {`);
      expect(css.slice(start, css.indexOf("}", start))).toMatch(
        /--geo-no-data: oklch\([\d.]+ 0 0\);/,
      );
    }
  });
});

describe("lookupCountryCount", () => {
  const data = {
    USA: 260,
    Italy: 188,
    Czechia: 12,
    Eswatini: 3,
  };

  it("matches direct names", () => {
    expect(lookupCountryCount("Italy", data)).toBe(188);
  });

  it("matches via alias when TopoJSON name differs from API name", () => {
    expect(lookupCountryCount("United States of America", data)).toBe(260);
    expect(lookupCountryCount("Czech Republic", data)).toBe(12);
    expect(lookupCountryCount("eSwatini", data)).toBe(3);
  });

  it("falls back to normalized comparison for stray punctuation", () => {
    expect(lookupCountryCount("italy ", data)).toBe(188);
  });

  it("returns 0 when no match exists", () => {
    expect(lookupCountryCount("Atlantis", data)).toBe(0);
  });

  it("skips zero-valued direct matches in favor of aliases", () => {
    expect(lookupCountryCount("United States of America", { ...data, "United States of America": 0 })).toBe(260);
  });
});

describe("resolveCountryDataKey", () => {
  const data = { USA: 260, Italy: 188 };

  it("returns the direct key when present", () => {
    expect(resolveCountryDataKey("Italy", data)).toBe("Italy");
  });

  it("returns the alias key when the topo name differs", () => {
    expect(resolveCountryDataKey("United States of America", data)).toBe("USA");
  });

  it("returns null when no match exists", () => {
    expect(resolveCountryDataKey("Atlantis", data)).toBeNull();
  });
});

describe("isUsaTopoName", () => {
  it("matches all three USA aliases", () => {
    expect(isUsaTopoName("United States of America")).toBe(true);
    expect(isUsaTopoName("United States")).toBe(true);
    expect(isUsaTopoName("USA")).toBe(true);
  });

  it("rejects other countries", () => {
    expect(isUsaTopoName("Canada")).toBe(false);
    expect(isUsaTopoName("Mexico")).toBe(false);
  });
});

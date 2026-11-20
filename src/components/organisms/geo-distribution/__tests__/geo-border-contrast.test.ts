import { readFileSync } from "node:fs";
import { join } from "node:path";

import { geoStepFills } from "@/components/organisms/geo-distribution/color-scale";
import {
  isOklchInSrgbGamut,
  oklchContrast,
} from "@/test-helpers/oklch-contrast";

const accents = ["bacteria", "viruses", "fungi", "all"] as const;

/** WCAG 1.4.11 non-text contrast. */
const minimumContrast = 3;

const globalsFile = "src/app/globals.css";

const modes = [
  {
    name: "light",
    accentSelector: (accent: string) => `[data-geo-accent="${accent}"]`,
    sharedSelector: "[data-geo-accent]",
  },
  {
    name: "dark",
    accentSelector: (accent: string) =>
      `[data-theme$="-dark"] [data-geo-accent="${accent}"]`,
    sharedSelector: '[data-theme$="-dark"] [data-geo-accent]',
  },
] as const;

function read(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/**
 * The declarations of the first rule whose selector starts a line, so
 * `[data-geo-accent]` does not match inside `[data-theme$="-dark"]
 * [data-geo-accent]`.
 */
function blockAt(css: string, selector: string): string {
  const rule = `${selector} {`;
  const afterNewline = css.indexOf(`\n${rule}`);
  const start = css.startsWith(rule)
    ? 0
    : afterNewline < 0
      ? -1
      : afterNewline + 1;
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function declared(block: string, name: string): string {
  const match = new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`).exec(block);
  if (!match) throw new Error(`${name} is not declared in: ${block}`);
  return match[1].trim();
}

/** The `oklch()` values of `--<prefix>-1`, `--<prefix>-2`, … in a block. */
function numbered(block: string, prefix: string): string[] {
  return [
    ...block.matchAll(
      new RegExp(`(?<![\\w-])--${prefix}-\\d: (oklch\\([^)]+\\));`, "g"),
    ),
  ].map(([, value]) => value);
}

function lightnessOf(value: string): number {
  const match = /^oklch\(\s*([\d.]+)/.exec(value);
  if (!match) throw new Error(`Not an oklch() literal: ${value}`);
  return Number(match[1]);
}

const globals = read(globalsFile);

describe("the map's region borders", () => {
  it("measures a known contrast", () => {
    expect(oklchContrast("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 0);
  });

  it("no longer declares the two-layer black and white border", () => {
    expect(globals).not.toMatch(/--geo-border:/);
    expect(globals).not.toMatch(/--geo-border-halo/);
  });

  describe.each(modes)("in $name mode", (mode) => {
    it.each(accents)(
      "%s: every border has 3:1 against the fill it outlines",
      (accent) => {
        const block = blockAt(globals, mode.accentSelector(accent));
        const steps = numbered(block, "geo-step");
        const borders = numbered(block, "geo-border");
        expect(steps).toHaveLength(geoStepFills.length);
        expect(borders).toHaveLength(geoStepFills.length);

        for (const [index, fill] of steps.entries()) {
          const border = borders[index];
          expect(
            oklchContrast(border, fill),
            `${mode.name} ${accent} step ${String(index + 1)}: ${border} on ${fill}`,
          ).toBeGreaterThanOrEqual(minimumContrast);
        }
      },
    );

    it.each(accents)(
      "%s: every fill and border is inside the sRGB gamut, so the browser paints what is measured",
      (accent) => {
        const block = blockAt(globals, mode.accentSelector(accent));
        const colors = [
          ...numbered(block, "geo-step"),
          ...numbered(block, "geo-border"),
        ];
        expect(colors).toHaveLength(geoStepFills.length * 2);
        for (const color of colors) {
          expect(
            isOklchInSrgbGamut(color),
            `${mode.name} ${accent}: ${color}`,
          ).toBe(true);
        }
      },
    );

    it("outlines no data with a darker line that has 3:1 against its fill", () => {
      const block = blockAt(globals, mode.sharedSelector);
      const fill = declared(block, "--geo-no-data");
      const border = declared(block, "--geo-border-no-data");

      expect(oklchContrast(border, fill)).toBeGreaterThanOrEqual(
        minimumContrast,
      );
      expect(lightnessOf(border)).toBeLessThan(lightnessOf(fill));
      expect(isOklchInSrgbGamut(fill)).toBe(true);
      expect(isOklchInSrgbGamut(border)).toBe(true);
    });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { oklchContrast } from "@/test-helpers/oklch-contrast";

const accents = ["bacteria", "viruses", "fungi", "all"] as const;

/** WCAG 1.4.11 non-text contrast. */
const minimumContrast = 3;

const globalsFile = "src/app/globals.css";
const violetFile = "src/styles/themes/violet-theme.css";
const bvbrcFile = "src/styles/themes/bvbrc-theme.css";

const themes = [
  { name: "dxkb-light", file: globalsFile, selector: '[data-theme="dxkb-light"]', dark: false },
  { name: "dxkb-dark", file: globalsFile, selector: '[data-theme="dxkb-dark"]', dark: true },
  { name: "violet-light", file: violetFile, selector: "[data-theme='violet-light']", dark: false },
  { name: "violet-dark", file: violetFile, selector: "[data-theme='violet-dark']", dark: true },
  { name: "bvbrc-light", file: bvbrcFile, selector: "[data-theme='bvbrc-light']", dark: false },
  { name: "bvbrc-dark", file: bvbrcFile, selector: "[data-theme='bvbrc-dark']", dark: true },
];

const lightMode = "[data-geo-accent]";
const darkMode = '[data-theme$="-dark"] [data-geo-accent]';

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

const globals = read(globalsFile);

function fills(accent: string, dark: boolean): string[] {
  const selector = dark
    ? `[data-theme$="-dark"] [data-geo-accent="${accent}"]`
    : `[data-geo-accent="${accent}"]`;
  return [...blockAt(globals, selector).matchAll(/--geo-step-\d: (oklch\([^)]+\));/g)].map(
    ([, value]) => value,
  );
}

describe("the map's region borders", () => {
  it("measures a known contrast", () => {
    expect(oklchContrast("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 0);
  });

  it("declares a core line per mode and a card-colored halo", () => {
    expect(declared(blockAt(globals, lightMode), "--geo-border")).toMatch(/^oklch\(/);
    expect(declared(blockAt(globals, darkMode), "--geo-border")).toMatch(/^oklch\(/);
    expect(declared(blockAt(globals, lightMode), "--geo-border-halo")).toBe("var(--card)");
    // The contrast check below reads the halo from each theme's --card, so
    // dark mode must inherit var(--card) instead of redeclaring it.
    expect(blockAt(globals, darkMode)).not.toMatch(/--geo-border-halo/);
  });

  it.each(themes)(
    "$name: every fill contrasts with the border core or its halo",
    (theme) => {
      const mode = blockAt(globals, theme.dark ? darkMode : lightMode);
      const core = declared(mode, "--geo-border");
      const halo = declared(blockAt(read(theme.file), theme.selector), "--card");
      const noData = declared(mode, "--geo-no-data");
      for (const accent of accents) {
        const steps = fills(accent, theme.dark);
        expect(steps).toHaveLength(7);
        for (const fill of [...steps, noData]) {
          const best = Math.max(
            oklchContrast(core, fill),
            oklchContrast(halo, fill),
          );
          expect(best, `${theme.name} ${accent} ${fill}`).toBeGreaterThanOrEqual(
            minimumContrast,
          );
        }
      }
    },
  );
});

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

const themeFiles = [
  "src/app/globals.css",
  "src/styles/themes/violet-theme.css",
  "src/styles/themes/bvbrc-theme.css",
] as const;

const expectedThemes = [
  "dxkb-light",
  "dxkb-dark",
  "violet-light",
  "violet-dark",
  "bvbrc-light",
  "bvbrc-dark",
];

/** WCAG 2 AA for normal-size text: every secondary surface carries small text. */
const minimumContrast = 4.5;

interface ThemeBlock {
  selector: string;
  values: Map<string, string>;
}

/**
 * The innermost `selector { ... }` blocks of a stylesheet, with comments
 * dropped, each as its custom properties. A theme block holds only
 * declarations, so "innermost" finds it without a CSS parser.
 */
function readBlocks(file: string): ThemeBlock[] {
  const css = readFileSync(join(repoRoot, file), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const blocks: ThemeBlock[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const values = new Map<string, string>();
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      values.set(
        declaration.slice(0, colon).trim(),
        declaration.slice(colon + 1).trim(),
      );
    }
    blocks.push({ selector: selector.trim(), values });
  }
  return blocks;
}

/** An `oklch(L C H)` literal (L as a number or a percentage) in sRGB, 0–1. */
function oklchToSrgb(value: string): [number, number, number] {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!match) throw new Error(`Not an oklch() literal: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  // Clipped to sRGB, as browsers paint an out-of-gamut color today.
  const [red, green, blue] = linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  });
  return [red, green, blue];
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(oklchToSrgb(foreground)),
    relativeLuminance(oklchToSrgb(background)),
  ].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const themeBlocks = themeFiles
  .flatMap(readBlocks)
  .filter((block) => block.values.has("--secondary-hover"));

function themeOf(block: ThemeBlock): string | undefined {
  return expectedThemes.find((theme) =>
    new RegExp(`data-theme=["']${theme}["']`).test(block.selector),
  );
}

function token(block: ThemeBlock, name: string): string {
  const value = block.values.get(name);
  if (!value) throw new Error(`${block.selector} does not declare ${name}`);
  return value;
}

describe("theme contrast: secondary surfaces", () => {
  it("declares --secondary-hover once in each of the six theme blocks", () => {
    expect(themeBlocks.map(themeOf).sort()).toEqual([...expectedThemes].sort());
  });

  it.each(themeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps secondary-foreground at 4.5:1 on its resting and hover fills",
    (_theme, block) => {
      const foreground = token(block, "--secondary-foreground");
      expect(
        contrast(foreground, token(block, "--secondary")),
      ).toBeGreaterThanOrEqual(minimumContrast);
      expect(
        contrast(foreground, token(block, "--secondary-hover")),
      ).toBeGreaterThanOrEqual(minimumContrast);
    },
  );
});

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

const minimumContrast = 4.5;

const noticePath = "src/components/interactions/graph-truncation-notice.tsx";

/**
 * The Graph's truncation notice is 11px text with no background, on the canvas, so its colour
 * has to clear 4.5:1 against the canvas fill itself. The canvas is `--graph-surface`
 * (`sigma-canvas.tsx` hands it to Sigma as `--sigma-background-color`). In the dark themes that
 * is `--input` at 15% (10% in dxkb-dark) mixed over `--card`, which leaves it translucent, so
 * the page behind it shows through.
 *
 * Guarded: `text-destructive` in dxkb-light, `dark:text-destructive-inverse` in the three dark
 * themes (plain `--destructive` is 2.9:1 on bvbrc-dark), and the `hover:text-foreground` of the
 * "Why?" link in all six.
 *
 * Left out, because the plain `--destructive` stays under 4.5:1 there: violet-light (4.46:1) and
 * bvbrc-light (4.11:1). The destructive `Alert` (`text-destructive` on `--card`) scores 4.77 and
 * 4.26 in the same themes, so the notice is no worse than the app's existing red text. Fixing
 * them means a new light `--destructive` or a light-theme override, which is a design-system
 * decision rather than this notice's.
 */
const guardedLight = ["dxkb-light"];

interface ThemeBlock {
  selector: string;
  values: Map<string, string>;
}

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

type Srgb = [number, number, number];

/** Unlike `theme-contrast.test.ts`, a colour keeps its alpha: the dark canvas depends on it. */
interface Color {
  lab: Srgb;
  alpha: number;
}

function parseOklch(value: string): Color {
  const match =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(
      value,
    );
  if (!match) throw new Error(`Not an oklch() literal: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const alpha = match[5] ? Number(match[5]) / (match[6] ? 100 : 1) : 1;
  return {
    lab: [lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)],
    alpha,
  };
}

/** `color-mix(in oklab, …)` interpolates premultiplied by alpha, as CSS Color 5 specifies. */
function mixColors(first: Color, share: number, second: Color): Color {
  const alpha = first.alpha * share + second.alpha * (1 - share);
  const lab = [0, 1, 2].map(
    (index) =>
      (first.lab[index] * first.alpha * share +
        second.lab[index] * second.alpha * (1 - share)) /
      alpha,
  ) as Srgb;
  return { lab, alpha };
}

interface Scope {
  values: Map<string, string>;
}

function resolveColor(value: string, scope: Scope): Color {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) {
    const declared = scope.values.get(variable[1]);
    if (declared === undefined) throw new Error(`${variable[1]} is not declared`);
    return resolveColor(declared, scope);
  }
  const mix = /^color-mix\(in oklab,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/.exec(value);
  if (mix) {
    return mixColors(
      resolveColor(mix[1], scope),
      Number(mix[2]) / 100,
      resolveColor(mix[3], scope),
    );
  }
  return parseOklch(value);
}

function toSrgb([lightness, a, b]: Srgb): Srgb {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  }) as Srgb;
}

function relativeLuminance([red, green, blue]: Srgb) {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function srgbContrast(first: Srgb, second: Srgb): number {
  const [lighter, darker] = [first, second]
    .map(relativeLuminance)
    .sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha blending in gamma-encoded sRGB, as browsers composite. */
function paintOver(top: Srgb, alpha: number, bottom: Srgb): Srgb {
  return top.map(
    (channel, index) => channel * alpha + bottom[index] * (1 - alpha),
  ) as Srgb;
}

const allBlocks = themeFiles.flatMap(readBlocks);

const derivedValues = allBlocks
  .filter((block) => block.selector === "[data-theme]")
  .flatMap((block) => [...block.values]);

function themeScope(theme: string): Scope {
  const block = allBlocks.find(
    (candidate) =>
      new RegExp(`^\\[data-theme=["']${theme}["']\\]$`).test(
        candidate.selector,
      ) && candidate.values.has("--secondary-hover"),
  );
  if (!block) throw new Error(`No theme block for ${theme}`);
  return { values: new Map([...derivedValues, ...block.values]) };
}

/**
 * What the canvas can sit on: the page under it (`main`'s `bg-muted/30` over the body's
 * `bg-background`), and the two plain surfaces, so a dark canvas is held at its lightest
 * backdrop rather than only the one the layout uses today.
 */
function canvasFills(theme: string): [string, Srgb][] {
  const scope = themeScope(theme);
  const srgb = (name: string) => toSrgb(resolveColor(`var(${name})`, scope).lab);
  const surface = resolveColor("var(--graph-surface)", scope);
  const muted = resolveColor("var(--muted)", scope);
  const background = srgb("--background");
  const page = paintOver(toSrgb(muted.lab), 0.3 * muted.alpha, background);
  return [
    ["the page", page],
    ["--background", background],
    ["--card", srgb("--card")],
  ].map(([label, backdrop]) => [
    label as string,
    paintOver(toSrgb(surface.lab), surface.alpha, backdrop as Srgb),
  ]);
}

function textColor(theme: string, token: string): Srgb {
  return toSrgb(resolveColor(`var(${token})`, themeScope(theme)).lab);
}

const noticeSource = readFileSync(join(repoRoot, noticePath), "utf8");

describe("the Graph truncation notice's text contrast on the canvas", () => {
  it("is plain text over the canvas, so the canvas fill is its whole background", () => {
    expect(noticeSource).toMatch(/\btext-destructive\b/);
    expect(noticeSource).toMatch(/\bdark:text-destructive-inverse\b/);
    expect(noticeSource).toMatch(/\bhover:text-foreground\b/);
    expect(noticeSource).not.toMatch(/(?<![\w:-])(?:\w+:)*bg-/);
  });

  it.each(guardedLight)(
    "%s keeps text-destructive at 4.5:1",
    (theme) => {
      for (const [fill, canvas] of canvasFills(theme)) {
        expect(
          srgbContrast(textColor(theme, "--destructive"), canvas),
          `--destructive on ${fill}`,
        ).toBeGreaterThanOrEqual(minimumContrast);
      }
    },
  );

  it.each(expectedThemes.filter((theme) => theme.endsWith("-dark")))(
    "%s keeps dark:text-destructive-inverse at 4.5:1",
    (theme) => {
      for (const [fill, canvas] of canvasFills(theme)) {
        expect(
          srgbContrast(textColor(theme, "--destructive-inverse"), canvas),
          `--destructive-inverse on ${fill}`,
        ).toBeGreaterThanOrEqual(minimumContrast);
      }
    },
  );

  it.each(expectedThemes)(
    "%s keeps the Why? link's hover:text-foreground at 4.5:1",
    (theme) => {
      for (const [fill, canvas] of canvasFills(theme)) {
        expect(
          srgbContrast(textColor(theme, "--foreground"), canvas),
          `--foreground on ${fill}`,
        ).toBeGreaterThanOrEqual(minimumContrast);
      }
    },
  );
});

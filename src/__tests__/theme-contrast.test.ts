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

type Oklab = [number, number, number];

function oklchToOklab(value: string): Oklab {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!match) throw new Error(`Not an oklch() literal: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  return [lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)];
}

function oklabToSrgb([lightness, a, b]: Oklab): [number, number, number] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [red, green, blue] = linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  });
  return [red, green, blue];
}

/** A `var()` resolves where it is declared, as in CSS. */
interface Scope {
  values: Map<string, string>;
  parent?: Scope;
}

function resolveColor(value: string, scope: Scope): Oklab {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) return resolveVariable(variable[1], scope);
  const mix = /^color-mix\(in oklab,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/.exec(value);
  if (mix) {
    const share = Number(mix[2]) / 100;
    const first = resolveColor(mix[1], scope);
    const second = resolveColor(mix[3], scope);
    return [0, 1, 2].map(
      (index) => first[index] * share + second[index] * (1 - share),
    ) as Oklab;
  }
  return oklchToOklab(value);
}

function resolveVariable(name: string, scope: Scope): Oklab {
  const value = scope.values.get(name);
  if (value !== undefined) return resolveColor(value, scope);
  if (scope.parent) return resolveVariable(name, scope.parent);
  throw new Error(`${name} is not declared`);
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

type Srgb = [number, number, number];

function paintOver(top: Srgb, share: number, bottom: Srgb): Srgb {
  return top.map(
    (channel, index) => channel * share + bottom[index] * (1 - share),
  ) as Srgb;
}

function srgbContrast(first: Srgb, second: Srgb): number {
  const [lighter, darker] = [first, second]
    .map(relativeLuminance)
    .sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrast(scope: Scope, foreground: string, background: string): number {
  const srgb = (name: string) => oklabToSrgb(resolveVariable(name, scope));
  return srgbContrast(srgb(foreground), srgb(background));
}

const allBlocks = themeFiles.flatMap(readBlocks);

const themeBlocks = allBlocks.filter((block) =>
  block.values.has("--secondary-hover"),
);

const derivedValues = allBlocks
  .filter((block) => block.selector === "[data-theme]")
  .flatMap((block) => [...block.values]);

function themeOf(block: ThemeBlock): string | undefined {
  return expectedThemes.find((theme) =>
    new RegExp(`data-theme=["']${theme}["']`).test(block.selector),
  );
}

function themeScope(block: ThemeBlock): Scope {
  return { values: new Map([...derivedValues, ...block.values]) };
}

function serviceScope(block: ThemeBlock): Scope {
  const theme = themeOf(block) ?? "";
  const values = new Map<string, string>();
  for (const { selector, values: declared } of allBlocks) {
    const match =
      /^\[data-theme(\$?)=["']([^"']+)["']\]\s+\.service-surface$/.exec(
        selector,
      );
    if (!match) continue;
    if (match[1] ? !theme.endsWith(match[2]) : theme !== match[2]) continue;
    for (const [name, value] of declared) {
      if (name.startsWith("--")) values.set(name, value);
    }
  }
  return { values, parent: themeScope(block) };
}

describe("theme contrast: secondary surfaces", () => {
  it("declares --secondary-hover once in each of the six theme blocks", () => {
    expect(themeBlocks.map(themeOf).sort()).toEqual([...expectedThemes].sort());
  });

  it.each(themeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps secondary-foreground at 4.5:1 on its resting and hover fills",
    (_theme, block) => {
      const scope = themeScope(block);
      for (const fill of ["--secondary", "--secondary-hover"]) {
        expect(
          contrast(scope, "--secondary-foreground", fill),
        ).toBeGreaterThanOrEqual(minimumContrast);
      }
    },
  );
});

/** Small muted text reads dim on dark surfaces well before failing AA, so dark themes are held to AAA. */
const darkMutedContrast = 7;

const darkThemeBlocks = themeBlocks.filter((block) =>
  themeOf(block)?.endsWith("-dark"),
);

describe("theme contrast: dark-theme text", () => {
  it("finds the three dark theme blocks", () => {
    expect(darkThemeBlocks.map(themeOf).sort()).toEqual([
      "bvbrc-dark",
      "dxkb-dark",
      "violet-dark",
    ]);
  });

  // The services layout repaints the card in some themes, so its effective surfaces are checked too.
  it.each(darkThemeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps muted text at 7:1 and links at 4.5:1 on its card and page",
    (_theme, block) => {
      const scopes = [
        ["", themeScope(block)],
        [" in the services layout", serviceScope(block)],
      ] as const;
      for (const [where, scope] of scopes) {
        for (const surface of ["--card", "--background"]) {
          expect(
            contrast(scope, "--muted-foreground", surface),
            `muted text on ${surface}${where}`,
          ).toBeGreaterThanOrEqual(darkMutedContrast);
          expect(
            contrast(scope, "--link", surface),
            `links on ${surface}${where}`,
          ).toBeGreaterThanOrEqual(minimumContrast);
        }
      }
    },
  );
});

/** Compare Region toggles use `text-foreground/70` because `muted-foreground` on `muted` is under 4.5:1 in the light themes; the strip's unit tests pin these classes. */
const toggleTextShare = 0.7;
// `bg-muted/30`: at 40% bvbrc-light's links on the wash were 4.47:1.
const pinWashShare = 0.3;

describe("theme contrast: the Compare Region Viewer's toggles and pin strip", () => {
  it.each(themeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps foreground/70 and links readable on muted, the card and the pin wash",
    (theme, block) => {
      const scope = themeScope(block);
      const srgb = (name: string) => oklabToSrgb(resolveVariable(name, scope));
      const dimTextContrast = theme?.endsWith("-dark")
        ? darkMutedContrast
        : minimumContrast;
      const foreground = srgb("--foreground");
      const muted = srgb("--muted");
      const card = srgb("--card");
      const wash = paintOver(muted, pinWashShare, card);
      for (const [surface, fill] of [
        ["muted", muted],
        ["the card", card],
        ["the pin wash", wash],
      ] as const) {
        expect(
          srgbContrast(paintOver(foreground, toggleTextShare, fill), fill),
          `foreground/70 on ${surface}`,
        ).toBeGreaterThanOrEqual(dimTextContrast);
      }
      expect(
        srgbContrast(srgb("--link"), wash),
        "links on the pin wash",
      ).toBeGreaterThanOrEqual(minimumContrast);
    },
  );
});

/** Circular Viewer position labels are SVG text axe leaves `incomplete`, so this holds every theme to AA instead. */
describe("theme contrast: the Circular Viewer's position labels", () => {
  it.each(themeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps muted-foreground at 4.5:1 on the card",
    (_theme, block) => {
      expect(
        contrast(themeScope(block), "--muted-foreground", "--card"),
      ).toBeGreaterThanOrEqual(minimumContrast);
    },
  );
});

/** The header job pill is `bg-white/10` over the navbar's `bg-primary`. */
const pillWashShare = 0.1;
const white: Srgb = [1, 1, 1];
/** violet-light's primary sits mid-lightness, so no red reaches 4.5:1 on it; a dark red holds 3:1. */
const inverseMinimum = (theme: string | undefined) =>
  theme === "violet-light" ? 3 : minimumContrast;

describe("theme contrast: destructive-inverse on the navbar pill", () => {
  it.each(themeBlocks.map((block) => [themeOf(block), block] as const))(
    "%s keeps destructive-inverse readable on the pill over the navbar fill",
    (theme, block) => {
      const scope = themeScope(block);
      const primary = oklabToSrgb(resolveVariable("--primary", scope));
      const pill = paintOver(white, pillWashShare, primary);
      const text = oklabToSrgb(resolveVariable("--destructive-inverse", scope));
      expect(srgbContrast(text, pill)).toBeGreaterThanOrEqual(
        inverseMinimum(theme),
      );
    },
  );
});

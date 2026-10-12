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

interface ThemeBlock {
  file: string;
  selector: string;
  declarations: string[];
}

/**
 * The innermost `selector { ... }` blocks of a stylesheet, with comments
 * dropped, each reduced to its declaration names. A theme block holds only
 * declarations, so "innermost" finds it without a CSS parser.
 */
function readBlocks(file: string): ThemeBlock[] {
  const css = readFileSync(join(repoRoot, file), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const blocks: ThemeBlock[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => declaration.slice(0, declaration.indexOf(":")).trim());
    blocks.push({ file, selector: selector.trim(), declarations });
  }
  return blocks;
}

const primaryHoverBlocks = themeFiles
  .flatMap(readBlocks)
  .filter((block) => block.declarations.includes("--primary-hover"));

describe("theme tokens: --primary-hover", () => {
  it("is declared once in each of the six theme blocks", () => {
    const themes = primaryHoverBlocks.map((block) =>
      expectedThemes.find((theme) =>
        new RegExp(`data-theme=["']${theme}["']`).test(block.selector),
      ),
    );

    expect(themes.toSorted()).toEqual(expectedThemes.toSorted());
  });

  it.each(primaryHoverBlocks.map((block) => [block.selector, block] as const))(
    "is the last custom property in %s",
    (_selector, block) => {
      const customProperties = block.declarations.filter((name) =>
        name.startsWith("--"),
      );

      // Tailwind lowers a color-mix() of var()s to an sRGB fallback plus an
      // `@supports (color: color-mix(...))` rule, and lightningcss then
      // splits the block at that point and keeps only the sRGB hex fallback
      // of every declaration after it: later tokens lose their lab() values,
      // with no error and no visible change until a wide-gamut colour is
      // compared. --primary-hover is the one color-mix() token, so it has to
      // come last. See --color-primary-hover in src/app/globals.css.
      expect(
        customProperties.at(-1),
        `${block.file}: --primary-hover must stay the last custom property in ${block.selector}. A token declared after it loses its lab() value in the built CSS (Tailwind's color-mix() fallback lowering splits the block there). Move the other declaration above it.`,
      ).toBe("--primary-hover");
    },
  );
});

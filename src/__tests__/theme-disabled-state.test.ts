import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

function read(file: string): string {
  // Comments dropped, so prose that names a declaration cannot satisfy a test.
  return readFileSync(join(repoRoot, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

const globals = read("src/app/globals.css");
const themeSources = {
  "dxkb-light": globals,
  "dxkb-dark": globals,
  "violet-light": read("src/styles/themes/violet-theme.css"),
  "violet-dark": read("src/styles/themes/violet-theme.css"),
  "bvbrc-light": read("src/styles/themes/bvbrc-theme.css"),
  "bvbrc-dark": read("src/styles/themes/bvbrc-theme.css"),
};

/** The declarations of `[data-theme="<theme>"] { ... }`. */
function themeBlock(css: string, theme: string): string {
  const match = new RegExp(
    `\\[data-theme=["']${theme}["']\\]\\s*\\{([^{}]*)\\}`,
  ).exec(css);
  expect(match, `no [data-theme="${theme}"] block`).not.toBeNull();
  return match?.[1] ?? "";
}

// The browser half (the fill a disabled field shows, the cursor, a disabled
// button keeping its fill on hover) runs in
// e2e/tests/services/service-form-controls.spec.ts, under the default theme
// only; these pin what every theme and the build need.
describe("disabled state: theme tokens", () => {
  it.each(Object.entries(themeSources))(
    "%s declares --disabled as a literal color",
    (theme, css) => {
      const value = /--disabled:\s*([^;]+);/.exec(themeBlock(css, theme))?.[1];

      expect(value, `${theme} has no --disabled`).toBeDefined();
      // A color-mix() of var()s here would split the block in the build and
      // strip the lab() values after it (see theme-token-order.test.ts).
      expect(value).toMatch(/^oklch\(/);
      expect(value).not.toMatch(/var\(|color-mix\(/);
    },
  );

  it("maps --color-disabled for the bg-disabled utility", () => {
    const themeInline = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(globals)?.[1];
    expect(themeInline).toMatch(/--color-disabled:\s*var\(--disabled\);/);
  });

  it("gives disabled service fields the shared fill instead of a transparent one", () => {
    const rule = /\.service-card-input:disabled,\s*\.service-card-textarea:disabled,\s*\.service-card-select-trigger:disabled\s*\{([^}]*)\}/.exec(
      globals,
    )?.[1];
    expect(rule).toMatch(/background-color:\s*var\(--disabled\);/);
  });
});

describe("disabled state: cursor and hover", () => {
  it("shows the not-allowed cursor on every :disabled element from the base layer", () => {
    const base = /@layer base\s*\{([\s\S]*?)\n\}/.exec(globals)?.[1];
    // In the base layer, so a call-site utility (`disabled:cursor-default`
    // on a non-sortable header) still wins.
    expect(base).toMatch(/:disabled\s*\{\s*cursor:\s*not-allowed;\s*\}/);
  });

  it("keeps hover utilities off disabled controls without raising their specificity", () => {
    expect(globals).toMatch(
      /@custom-variant hover\s*\{\s*@media \(hover: hover\)\s*\{\s*&:hover:where\(:not\(:disabled\)\)\s*\{\s*@slot;/,
    );
  });
});

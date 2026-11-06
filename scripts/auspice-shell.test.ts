import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Guards the contract between the two halves of the Auspice theming setup:
// `scripts/build-auspice.mjs` injects a bridge that copies a fixed list of host
// tokens into the iframe, and `public/auspice-dark.css` consumes them. A token
// added to the stylesheet but not the bridge silently falls back to the stock
// Auspice colour, which is exactly the kind of drift nobody notices by eye.
//
// Reads both files as source text rather than importing the build script,
// which would run a full webpack build on import. The built shell itself is
// gitignored and absent in CI, so it cannot be asserted on here.

const root = resolve(__dirname, "..");
const buildScript = readFileSync(resolve(root, "scripts/build-auspice.mjs"), "utf8");
const sheet = readFileSync(resolve(root, "public/auspice-dark.css"), "utf8");

// Defined inside the stylesheet's own :root, so they are not bridged.
const locallyDefined = new Set(["canvas", "brand", "dim", "edge"]);

function bridgedTokens(): string[] {
  const match = /const bridgedTokens = \[([\s\S]*?)\]/.exec(buildScript);
  if (!match) throw new Error("bridgedTokens array not found in build-auspice.mjs");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("Auspice theme bridge", () => {
  it("rebuilds when the generated favicon is missing", () => {
    const outputCheck = /const outputExists =([\s\S]*?);\nif \(/.exec(buildScript);
    if (!outputCheck) throw new Error("outputExists check not found in build-auspice.mjs");
    expect(outputCheck[1]).toContain('"auspice-favicon.png"');
  });

  it("injects the stylesheet and an inline bridge into the built shell", () => {
    expect(buildScript).toContain('<link rel="stylesheet" href="/auspice-dark.css">');
    expect(buildScript).toContain("<script>${themeBridge}</script>");
    // The injection anchors on </head>; a shell without one must fail loudly
    // rather than silently ship an unthemed viewer.
    expect(buildScript).toMatch(/if \(!shell\.includes\("\/auspice-dark\.css"\)\)/);
  });

  it("points the shell's favicon links at the copied favicon, quoted or not", () => {
    // The built index.html is minified, so its links read `href=/favicon.png`
    // with no quotes. A quoted-only replacement left both links pointing at a
    // /favicon.png the app does not serve.
    const match = /\.replaceAll\(\/(.+?)\/g, '(href="\/auspice-favicon\.png")'\)/.exec(buildScript);
    if (!match) throw new Error("favicon replaceAll not found in build-auspice.mjs");
    const rewrite = (html: string) => html.replaceAll(new RegExp(match[1], "g"), match[2]);
    expect(rewrite('<link rel=icon href=/favicon.png type=image/png>')).toBe(
      '<link rel=icon href="/auspice-favicon.png" type=image/png>',
    );
    expect(rewrite('<link rel="icon" href="/favicon.png">')).toBe(
      '<link rel="icon" href="/auspice-favicon.png">',
    );
  });

  it("runs inline before first paint rather than loading an external script", () => {
    // An external <script src> would resolve after the first frame and flash light.
    expect(buildScript).not.toMatch(/<script src="[^"]*bridge/);
  });

  it("degrades to a no-op when Auspice is opened outside DXKB", () => {
    expect(buildScript).toContain("if(host===window)return");
    expect(buildScript).toMatch(/catch\(e\)\{\}/);
  });

  it("re-syncs when the host theme changes", () => {
    expect(buildScript).toContain("MutationObserver");
    expect(buildScript).toContain('attributeFilter:["data-theme","class","style"]');
  });

  it("bridges every token the stylesheet consumes", () => {
    const bridged = new Set(
      bridgedTokens().map((name) => (name === "font-geist-sans" ? "font" : name)),
    );
    const consumed = new Set(
      [...sheet.matchAll(/var\(--dxkb-([\w-]+)/g)].map((m) => m[1]),
    );
    const missing = [...consumed].filter(
      (name) => !bridged.has(name) && !locallyDefined.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("bridges every token auspice/config.json references", () => {
    const config = readFileSync(resolve(root, "auspice/config.json"), "utf8");
    const bridged = new Set(
      bridgedTokens().map((name) => (name === "font-geist-sans" ? "font" : name)),
    );
    const consumed = [...config.matchAll(/var\(--dxkb-([\w-]+)/g)].map((m) => m[1]);
    const missing = consumed.filter(
      (name) => !bridged.has(name) && !locallyDefined.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("defines every token it exempts from the bridge", () => {
    // `locallyDefined` is an allowlist, so a token added to it but never given a
    // value in :root would resolve to `initial` — a transparent border or an
    // invisible label — while both drift guards above stayed green.
    const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(sheet);
    if (!rootBlock) throw new Error(":root block not found in auspice-dark.css");
    const defined = new Set(
      [...rootBlock[1].matchAll(/--dxkb-([\w-]+)\s*:/g)].map((m) => m[1]),
    );
    const undefinedTokens = [...locallyDefined].filter((name) => !defined.has(name));
    expect(undefinedTokens).toEqual([]);
  });

  it("keeps a stock-Auspice fallback on every bridged var() in the stylesheet", () => {
    // Without a fallback the standalone viewer (no bridge, no tokens) renders
    // with `initial` values — transparent text on transparent panels.
    const noFallback = [...sheet.matchAll(/var\(--dxkb-([\w-]+)\s*\)/g)]
      .map((m) => m[1])
      .filter((name) => !locallyDefined.has(name));
    expect(noFallback).toEqual([]);
  });

  it("keeps the sidebar chevron anchored to the nav bar's content edge", () => {
    // The chevron is `position: fixed`, so it escapes to the viewport unless
    // NavBarContainer establishes a containing block. Without the transform the
    // `right: 0` below silently resolves against the viewport instead of the
    // nav bar and the chevron lands back on top of the scroll gutter — which
    // still renders a plausible-looking chevron, just in the wrong place.
    expect(sheet).toMatch(/\[class\*="NavBarContainer"\]\s*\{[^}]*transform:\s*translateZ\(0\)/);
    const chevron = /\[class\*="NavBarContainer"\] > div\[style\*="position: fixed"\]\s*\{([^}]*)\}/
      .exec(sheet);
    if (!chevron) throw new Error("chevron rule not found in auspice-dark.css");
    // The component's inline `left: sidebarWidth - 12` measures from the
    // sidebar's outer edge, i.e. under the gutter. Both halves are needed:
    // clearing `left` without setting `right` just unpins it.
    expect(chevron[1]).toMatch(/left:\s*auto\s*!important/);
    expect(chevron[1]).toMatch(/right:\s*0\s*!important/);
  });

  it("mirrors color-scheme into the iframe", () => {
    // color-scheme does not cross a frame boundary any more than a custom
    // property does. Without this the UA paints light scrollbars over the dark
    // chrome — the original defect.
    expect(sheet).toMatch(
      /html\[data-theme\$="-dark"\]\s*\{[^}]*color-scheme:\s*dark/,
    );
  });

  it("leaves the categorical colour scales alone", () => {
    // Tip fills and legend swatches encode the data. Only the translucent white
    // legend backing plates are retargeted, matched on their rgba( prefix.
    expect(sheet).not.toMatch(/\.tip\s*\{/);
    expect(sheet).not.toMatch(/\.branch\s*\{/);
    expect(sheet).toContain('rect[fill^="rgba(255"]');
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Guards the token list the bridge in `scripts/build-auspice.mjs` copies into
// the iframe against what `public/auspice-dark.css` consumes. Reads both as
// source text because importing the build script would run a webpack build.

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
    // The injection anchors on </head>; a shell without one must fail loudly.
    expect(buildScript).toMatch(/if \(!shell\.includes\("\/auspice-dark\.css"\)\)/);
  });

  it("points the shell's favicon links at the copied favicon, quoted or not", () => {
    // The built index.html is minified, so links read `href=/favicon.png`
    // with no quotes.
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
    // An external <script src> would resolve after the first frame and flash
    // light.
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
    // `locallyDefined` is an allowlist, so a token with no value in :root
    // would resolve to `initial`.
    const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(sheet);
    if (!rootBlock) throw new Error(":root block not found in auspice-dark.css");
    const defined = new Set(
      [...rootBlock[1].matchAll(/--dxkb-([\w-]+)\s*:/g)].map((m) => m[1]),
    );
    const undefinedTokens = [...locallyDefined].filter((name) => !defined.has(name));
    expect(undefinedTokens).toEqual([]);
  });

  it("keeps a stock-Auspice fallback on every bridged var() in the stylesheet", () => {
    // Without a fallback the standalone viewer renders `initial` values.
    const noFallback = [...sheet.matchAll(/var\(--dxkb-([\w-]+)\s*\)/g)]
      .map((m) => m[1])
      .filter((name) => !locallyDefined.has(name));
    expect(noFallback).toEqual([]);
  });

  it("keeps the sidebar chevron anchored to the nav bar's content edge", () => {
    // The chevron is `position: fixed`, so without the transform `right: 0`
    // resolves against the viewport instead of the nav bar.
    expect(sheet).toMatch(/\[class\*="NavBarContainer"\]\s*\{[^}]*transform:\s*translateZ\(0\)/);
    const chevron = /\[class\*="NavBarContainer"\] > div\[style\*="position: fixed"\]\s*\{([^}]*)\}/
      .exec(sheet);
    if (!chevron) throw new Error("chevron rule not found in auspice-dark.css");
    // The inline `left: sidebarWidth - 12` measures from the sidebar's outer
    // edge, so both `left` and `right` must be set.
    expect(chevron[1]).toMatch(/left:\s*auto\s*!important/);
    expect(chevron[1]).toMatch(/right:\s*0\s*!important/);
  });

  it("mirrors color-scheme into the iframe", () => {
    // color-scheme does not cross a frame boundary, so the UA would paint
    // light scrollbars over dark chrome.
    expect(sheet).toMatch(
      /html\[data-theme\$="-dark"\]\s*\{[^}]*color-scheme:\s*dark/,
    );
  });

  it("leaves the categorical colour scales alone", () => {
    // Only the translucent white legend backing plates are retargeted,
    // matched on their rgba( prefix.
    expect(sheet).not.toMatch(/\.tip\s*\{/);
    expect(sheet).not.toMatch(/\.branch\s*\{/);
    expect(sheet).toContain('rect[fill^="rgba(255"]');
  });
});

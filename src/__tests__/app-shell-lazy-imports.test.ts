import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { valueImportsMatching } from "@/test-helpers/static-imports";

const srcDir = resolve(__dirname, "..");

// Modules on every route (root layout, navbars) that reach their heavy parts
// only through `next/dynamic` or `import()`: a value import puts those parts
// back in every route's initial bundle.
const shellModules: [file: string, heavy: RegExp][] = [
  [
    "components/search/command-palette.tsx",
    /^@\/components\/(?:ui\/command|search\/command-palette-body|navbars\/navbar-links)$|^cmdk$/,
  ],
  [
    "components/navbars/mobile-navbar.tsx",
    /^@\/components\/navbars\/mobile-sheet-navigation$/,
  ],
];

describe("app shell lazy imports", () => {
  it("keep the palette body and mobile sheet body out of the static graph", () => {
    const offenders = shellModules.flatMap(([file, heavy]) => {
      const path = resolve(srcDir, file);
      return valueImportsMatching(
        readFileSync(path, "utf8"),
        dirname(path),
        heavy,
      ).map((specifier) => `${file}: ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("would catch a static import of each heavy module", () => {
    const [[, palette], [, sheet]] = shellModules;
    const fromDir = resolve(srcDir, "components/search");
    expect(
      valueImportsMatching(
        'import { CommandPaletteBody } from "./command-palette-body";\nimport { Command } from "@/components/ui/command";',
        fromDir,
        palette,
      ),
    ).toEqual(["./command-palette-body", "@/components/ui/command"]);
    expect(
      valueImportsMatching(
        'import { MobileSheetNavigation } from "@/components/navbars/mobile-sheet-navigation";',
        fromDir,
        sheet,
      ),
    ).toHaveLength(1);
  });
});

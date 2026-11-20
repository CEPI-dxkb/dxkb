import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function installedMajor(pkg: string): number {
  const manifest = JSON.parse(
    readFileSync(join(root, "node_modules", pkg, "package.json"), "utf8"),
  ) as { version: string };
  return Number(manifest.version.split(".")[0]);
}

describe("sigma stack", () => {
  it.each([
    ["sigma", 4],
    ["@react-sigma/core", 6],
    ["@sigma/export-image", 4],
  ] as const)("%s is on major %i", (pkg, major) => {
    expect(installedMajor(pkg)).toBe(major);
  });

  it("resolves one sigma copy for the whole stack", () => {
    // pnpm can leave an old `sigma@3.x` folder in node_modules/.pnpm after a bump,
    // so compare resolved paths, not folder names.
    const direct = realpathSync(join(root, "node_modules/sigma"));
    for (const pkg of ["@react-sigma/core", "@sigma/export-image"]) {
      const pkgDir = realpathSync(join(root, "node_modules", pkg));
      expect(realpathSync(join(pkgDir, "../../sigma"))).toBe(direct);
    }
  });
});

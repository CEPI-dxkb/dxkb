import { glob, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

/**
 * Line-anchored so a commented-out call cannot satisfy the guard; the import
 * line has no `await`, so it never matches.
 */
const guardCallPattern =
  /^\s*(?:(?:const|let|var)\s+[^=]+=\s*)?await\s+requireCurrentUserOrRedirect\(/m;

const protectedLayouts = [
  "src/app/copilot/layout.tsx",
  "src/app/jobs/layout.tsx",
  "src/app/settings/layout.tsx",
  "src/app/viewer/structure/layout.tsx",
  "src/app/services/(genomics)/layout.tsx",
  "src/app/services/(metagenomics)/layout.tsx",
  "src/app/services/(phylogenomics)/layout.tsx",
  "src/app/services/(protein-tools)/layout.tsx",
  "src/app/services/(utilities)/layout.tsx",
  "src/app/services/(viral-tools)/layout.tsx",
  "src/app/workspace/layout.tsx",
] as const;

const publicLayouts = [
  "src/app/layout.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/(footer)/layout.tsx",
  "src/app/(footer)/citations/layout.tsx",
  "src/app/(views)/layout.tsx",
  "src/app/advanced-search/layout.tsx",
  "src/app/organisms/layout.tsx",
  "src/app/search/layout.tsx",
  "src/app/services/layout.tsx",
] as const;

const workspaceRedirectPages = new Set<string>([
  "src/app/workspace/home/[[...path]]/page.tsx",
  "src/app/workspace/shared/[[...path]]/page.tsx",
  "src/app/workspace/workshop/page.tsx",
]);

const publicExceptions = ["src/app/services/page.tsx"] as const;

async function readSource(path: string): Promise<string> {
  return readFile(resolve(path), "utf8");
}

describe("protected route server boundaries", () => {
  it("classifies every layout under src/app as protected or public", async () => {
    const discovered: string[] = [];
    for await (const match of glob("src/app/**/layout.tsx")) {
      discovered.push(match.split(sep).join("/"));
    }

    expect(discovered.toSorted()).toEqual(
      [...protectedLayouts, ...publicLayouts].toSorted(),
    );
  });

  it.each(protectedLayouts)(
    "%s validates the current user before rendering",
    async (path) => {
      expect(await readSource(path)).toMatch(guardCallPattern);
    },
  );

  it("validates the current user in every workspace page that renders", async () => {
    // Layouts are not re-rendered on client-side navigation, so each rendering
    // page repeats the check.
    const discovered: string[] = [];
    for await (const match of glob("src/app/workspace/**/page.tsx")) {
      discovered.push(match.split(sep).join("/"));
    }

    expect(discovered).toEqual(expect.arrayContaining([...workspaceRedirectPages]));
    const renderingPages = discovered.filter(
      (path) => !workspaceRedirectPages.has(path),
    );
    expect(renderingPages.length).toBeGreaterThan(0);
    for (const path of renderingPages) {
      expect(await readSource(path), path).toMatch(guardCallPattern);
    }
  });

  it.each(publicLayouts)("keeps %s unguarded for its subtree", async (path) => {
    expect(await readSource(path)).not.toMatch(guardCallPattern);
  });

  it.each(publicExceptions)(
    "keeps %s outside a protected boundary",
    async (path) => {
      expect(await readSource(path)).not.toMatch(guardCallPattern);
    },
  );
});

import { glob, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

/**
 * Line-anchored so a commented-out or otherwise unreachable call cannot satisfy
 * the guard assertion. The optional binding prefix covers the destructuring form
 * (`const { id } = await requireCurrentUserOrRedirect(...)`); the import line has
 * no `await` and no open paren after the name, so it never matches.
 */
const guardCallPattern =
  /^\s*(?:(?:const|let|var)\s+[^=]+=\s*)?await\s+requireCurrentUserOrRedirect\(/m;

const protectedLayouts = [
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

/**
 * Layouts that must stay unguarded — hence the symmetric assertion, not just an
 * omission.
 */
const publicLayouts = [
  "src/app/layout.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/(footer)/layout.tsx",
  "src/app/(footer)/citations/layout.tsx",
  "src/app/(views)/layout.tsx",
  "src/app/organisms/layout.tsx",
  "src/app/search/layout.tsx",
  "src/app/services/layout.tsx",
] as const;

/**
 * Workspace pages that only redirect to another workspace page, which runs the
 * check itself. Every other workspace page must validate the user.
 */
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

    // A new layout is unclassified until it is added to one of the two lists.
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
    // Layouts are not re-rendered on client-side navigation, so the workspace
    // layout guard alone would miss a folder-to-folder move on an expired
    // session. Each rendering page repeats the check.
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

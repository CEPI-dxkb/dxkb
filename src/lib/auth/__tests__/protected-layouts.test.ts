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
  "src/app/workspace/[username]/layout.tsx",
  "src/app/workspace/home/layout.tsx",
  "src/app/workspace/shared/layout.tsx",
] as const;

/**
 * Layouts that must stay unguarded. `src/app/workspace/layout.tsx` is the direct
 * ancestor of the public workspace routes below, so a guard added here would put
 * them behind a login wall — hence the symmetric assertion, not just an omission.
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
  "src/app/workspace/layout.tsx",
] as const;

const protectedPagesWithInlineChecks = ["src/app/workspace/page.tsx"] as const;

const publicExceptions = [
  "src/app/services/page.tsx",
  "src/app/workspace/public/page.tsx",
  "src/app/workspace/public/[username]/page.tsx",
  "src/app/workspace/public/[username]/[...path]/page.tsx",
  "src/app/workspace/workshop/page.tsx",
] as const;

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

  it.each([...protectedLayouts, ...protectedPagesWithInlineChecks])(
    "%s validates the current user before rendering",
    async (path) => {
      expect(await readSource(path)).toMatch(guardCallPattern);
    },
  );

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

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

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

const protectedPagesWithInlineChecks = ["src/app/workspace/page.tsx"] as const;

const publicExceptions = [
  "src/app/services/page.tsx",
  "src/app/workspace/public/page.tsx",
  "src/app/workspace/public/[username]/[...path]/page.tsx",
  "src/app/workspace/workshop/page.tsx",
] as const;

describe("protected route server boundaries", () => {
  it.each([...protectedLayouts, ...protectedPagesWithInlineChecks])(
    "%s validates the current user before rendering",
    async (path) => {
      const source = await readFile(resolve(path), "utf8");
      expect(source).toContain("requireCurrentUserOrRedirect(");
    },
  );

  it.each(publicExceptions)(
    "keeps %s outside a protected boundary",
    async (path) => {
      const source = await readFile(resolve(path), "utf8");
      expect(source).not.toContain("requireCurrentUserOrRedirect(");
    },
  );
});

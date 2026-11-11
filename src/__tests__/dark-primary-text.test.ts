import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

const allowed = new Map([
  // The help search box is a white island in every theme.
  ["src/components/heros/help-hero.tsx", "sits on bg-white"],
  // The checked dot of a radio, a state indicator rather than text.
  ["src/components/ui/radio-group.tsx", "radio dot, not text"],
]);

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

const barePrimaryText = /(?<![\w:-])text-primary(?![\w/-])/;

const readableDarkText =
  /(?<![\w:-])dark:text-(?:link|foreground|primary-foreground)(?![\w/-])/;

/** `--primary` stays dark in dark themes (2.1 to 3.0:1 as text), so `text-primary` needs a readable dark override in the same class string. */
describe("text-primary in dark themes", () => {
  it("pairs every bare text-primary class string with a readable dark override", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(repoRoot, "src"))) {
      const path = relative(repoRoot, file);
      if (allowed.has(path)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const [, classes] of line.matchAll(/["'`]([^"'`]*)["'`]/g)) {
          if (barePrimaryText.test(classes) && !readableDarkText.test(classes)) {
            offenders.push(`${path}:${String(index + 1)}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});

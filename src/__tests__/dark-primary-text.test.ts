import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

/**
 * Files whose bare `text-primary` is allowed to stay navy in a dark theme,
 * each with the reason.
 */
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

/** A bare `text-primary` class: no variant prefix, no `-foreground`, no `/opacity`. */
const barePrimaryText = /(?<![\w:-])text-primary(?![\w/-])/;

/**
 * The dark overrides that are readable on a dark card: `link`, `foreground`,
 * and `primary-foreground` for a control that also fills itself `dark:bg-primary`
 * (the soft button, the select chevron). Opaque only: `/80` dims the text again.
 */
const readableDarkText =
  /(?<![\w:-])dark:text-(?:link|foreground|primary-foreground)(?![\w/-])/;

/**
 * `--primary` is a button fill. Each dark theme keeps it dark so white text
 * on a primary button stays readable, which leaves it at 2.1 to 3.0:1 as text
 * on a dark card. A class string that colors text `text-primary` therefore
 * also needs a readable dark override in the same string: `dark:text-link`
 * for a link, or `dark:text-foreground` for an active or selected label.
 * Any other `dark:text-*` (`dark:text-primary` itself) would keep it unreadable.
 */
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

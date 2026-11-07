import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(
  resolve(__dirname, "..", "app", "globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** One rank badge selector: the bare default, or a rank by name. */
const badgeSelector = /^\[data-slot="badge"\]\[data-rank(?:="([^"]+)")?\]$/;

/**
 * Each rank badge rule: the ranks its selectors name, and its `@apply` classes.
 * Rules are split on braces first and then filtered, because one pattern that
 * repeats the badge selector up to the `{` backtracks exponentially. Each
 * match starts at the text start or a brace, which keeps the split linear.
 * Only exact badge selectors count, so another `[data-rank]` selector (a rank
 * icon, say) neither adds a rank nor makes its rule a badge rule.
 */
const rankRules = [
  ...globalsCss.matchAll(/(?<=^|[{}])([^{}]*)\{([^{}]*)\}/g),
]
  .map(([, selectors, body]) => ({
    ranks: selectors
      .split(",")
      .map((selector) => badgeSelector.exec(selector.trim()))
      .filter((match) => match !== null)
      // A bare `[data-rank]` (the default) leaves the group unmatched.
      .map(([, rank]) => rank || "*"),
    classes: body.trim(),
  }))
  .filter((rule) => rule.ranks.length > 0);

// Every taxon_rank value the BV-BRC taxonomy core held on 2026-10-20.
const bvbrcRanks = [
  "acellular root", "biotype", "cellular root", "clade", "class", "cohort",
  "domain", "family", "forma", "forma specialis", "genotype", "genus",
  "infraclass", "infraorder", "isolate", "kingdom", "morph", "no rank",
  "order", "parvorder", "pathogroup", "phylum", "realm", "section", "series",
  "serogroup", "serotype", "species", "species group", "species subgroup",
  "strain", "subclass", "subcohort", "subfamily", "subgenus", "subkingdom",
  "suborder", "subphylum", "subsection", "subspecies", "subtribe",
  "subvariety", "superclass", "superfamily", "superorder", "superphylum",
  "tribe", "varietas",
];

// Ranks the core lacks but the stylesheet still colors (NCBI's retired
// `superkingdom`, `subtype`) need the same check, so test every rank either
// side names.
const checkedRanks = [
  ...new Set([
    ...bvbrcRanks,
    ...rankRules.flatMap((rule) => rule.ranks).filter((rank) => rank !== "*"),
  ]),
];

function classesFor(rank: string): string | undefined {
  return (
    rankRules.find((rule) => rule.ranks.includes(rank)) ??
    rankRules.find((rule) => rule.ranks.includes("*"))
  )?.classes;
}

describe("taxonomy rank badge colors", () => {
  it("keeps the colored default first, so a named rank overrides it", () => {
    expect(rankRules[0]?.ranks).toEqual(["*"]);
  });

  it("draws only 'no rank' in neutral gray", () => {
    expect(classesFor("no rank")).toContain("bg-muted");
    expect(checkedRanks).toEqual(
      expect.arrayContaining(["superkingdom", "subtype"]),
    );
    const gray = checkedRanks.filter(
      (rank) => rank !== "no rank" && classesFor(rank)?.includes("bg-muted"),
    );
    expect(gray).toEqual([]);
  });

  it("tells species groups apart from species and genus", () => {
    const speciesGroup = classesFor("species group");
    expect(speciesGroup).not.toBe(classesFor("species"));
    expect(speciesGroup).not.toBe(classesFor("genus"));
  });

  it("gives a rank with no rule of its own a chart color, not gray", () => {
    expect(classesFor("a rank added later")).toMatch(/bg-chart-\d+\/15/);
  });
});

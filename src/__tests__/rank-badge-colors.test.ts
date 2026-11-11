import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(
  resolve(__dirname, "..", "app", "globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const badgeSelector = /^\[data-slot="badge"\]\[data-rank(?:="([^"]+)")?\]$/;

/** Rules are split on braces first because a pattern repeating the badge selector up to `{` backtracks exponentially; only exact badge selectors count. */
const rankRules = [
  ...globalsCss.matchAll(/(?<=^|[{}])([^{}]*)\{([^{}]*)\}/g),
]
  .map(([, selectors, body]) => ({
    ranks: selectors
      .split(",")
      .map((selector) => badgeSelector.exec(selector.trim()))
      .filter((match) => match !== null)
      .map(([, rank]) => rank || "*"),
    classes: body.trim(),
  }))
  .filter((rule) => rule.ranks.length > 0);

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

// Ranks the core lacks but the stylesheet colors (e.g. retired `superkingdom`) need the same check.
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

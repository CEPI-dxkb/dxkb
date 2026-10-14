import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { defaultViewDescriptors } from "@/components/organisms/shared/default-nav-items";
import { searchTypeIcon } from "@/components/search/all-types/type-results-card";
import { getCuratedLists } from "@/lib/taxon-view/curated-lists";
import { buildTabContext } from "@/lib/taxon-view/tab-context";
import { resolveTabs } from "@/lib/taxon-view/tab-policy";

import { viewIcons, type ViewIconKey } from "../view-icons";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");

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

describe("viewIcons", () => {
  it("gives the organism and taxon rails the registry's icons", () => {
    const taxonTabs = resolveTabs(buildTabContext(null, null, getCuratedLists()));
    const registered = new Set<unknown>(Object.values(viewIcons));

    for (const tab of [...defaultViewDescriptors, ...taxonTabs]) {
      expect(registered.has(tab.icon), tab.key).toBe(true);
    }
  });

  it.each<[string, ViewIconKey]>([
    ["sequences", "sequences"],
    ["features", "features"],
    ["protein-structures", "proteinStructures"],
    ["domains-and-motifs", "domainsAndMotifs"],
    ["strains", "strains"],
    ["surveillance", "surveillance"],
    ["serology", "serology"],
  ])("shows the taxon rail's %s icon", (key, icon) => {
    const taxonTabs = resolveTabs(buildTabContext(null, null, getCuratedLists()));
    expect(taxonTabs.find((tab) => tab.key === key)?.icon).toBe(viewIcons[icon]);
  });

  it("shows each search data type with its view's icon", () => {
    expect(searchTypeIcon("genome")).toBe(viewIcons.genomes);
    expect(searchTypeIcon("genome_feature")).toBe(viewIcons.features);
    expect(searchTypeIcon("protein_structure")).toBe(
      viewIcons.proteinStructures,
    );
    expect(searchTypeIcon("surveillance")).toBe(viewIcons.surveillance);
  });

  it("is the only place a view rail defines a tab icon", () => {
    // A tab icon written at the call site (`icon: <Dna />`) is how the Genome
    // list's Sequences tab came to differ from the organism pages' one.
    const roots = [
      "src/app/(views)",
      "src/components/organisms",
      "src/lib/taxon-view",
      "src/components/search/all-types",
    ];
    const offenders = roots.flatMap((root) =>
      [...sourceFiles(join(repoRoot, root))]
        .filter((file) => /icon(: |=\{)<[A-Z]/.test(readFileSync(file, "utf8")))
        .map((file) => relative(repoRoot, file)),
    );

    expect(offenders).toEqual([]);
  });
});

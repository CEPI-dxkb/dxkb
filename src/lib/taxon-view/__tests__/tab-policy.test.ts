import type { ComponentType } from "react";

import { buildTabContext } from "../tab-context";
import type { PhyloManifest } from "../tab-context";
import { getCuratedLists } from "../curated-lists";
import { resolveTabs } from "../tab-policy";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import type { OrganismViewKey } from "@/components/organisms/types";

function tax(over: Partial<OrganismTaxonomy>): OrganismTaxonomy {
  return {
    taxonId: 1,
    taxonName: "x",
    taxonRank: "species",
    lineageNames: [],
    lineageIds: [],
    genomes: 0,
    ...over,
  };
}

function enabledKeys(
  taxon: OrganismTaxonomy,
  manifest: PhyloManifest | null = null,
): Set<OrganismViewKey> {
  const ctx = buildTabContext(taxon, manifest, getCuratedLists());
  const tabs = resolveTabs(ctx);
  return new Set(tabs.filter((t) => t.enabled !== false).map((t) => t.key));
}

const baseline: OrganismViewKey[] = [
  "overview", "taxa-tree", "genomes", "sequences", "features",
  "protein-structures", "domains-and-motifs", "epitopes", "experiments",
];

describe("resolveTabs — structure", () => {
  it("always returns all 16 tabs in fixed order", () => {
    const tabs = resolveTabs(buildTabContext(null, null, getCuratedLists()));
    expect(tabs).toHaveLength(16);
    expect(tabs.map((t) => t.key)).toEqual([
      "overview", "phylogeny", "taxa-tree", "strains", "genomes",
      "amr-phenotypes", "sequences", "features", "protein-structures",
      "domains-and-motifs", "sfvt", "epitopes", "experiments",
      "surveillance", "serology", "interactions",
    ]);
  });

  it("baseline tabs are always enabled regardless of taxon content", () => {
    const keys = enabledKeys(tax({}));
    for (const k of baseline) expect(keys.has(k)).toBe(true);
  });

  it("disabled tabs carry a disabledReason", () => {
    const ctx = buildTabContext(tax({ lineageNames: ["Viruses"] }), null, getCuratedLists());
    const interactions = resolveTabs(ctx).find((t) => t.key === "interactions");
    expect(interactions?.enabled).toBe(false);
    expect(interactions?.disabledReason).toMatch(/bacterial/i);
  });

  it("applies a Component override (overview)", () => {
    function CustomOverview() { return null; }
    const ctx = buildTabContext(tax({}), null, getCuratedLists());
    const tabs = resolveTabs(ctx, { overview: { Component: CustomOverview as ComponentType } });
    expect(tabs.find((t) => t.key === "overview")?.Component).toBe(CustomOverview);
  });
});

describe("resolveTabs — doc §5 truth table (conditional tabs only)", () => {
  const cond: OrganismViewKey[] = [
    "phylogeny", "amr-phenotypes", "strains", "surveillance", "serology", "sfvt",
    "interactions",
  ];
  function condEnabled(taxon: OrganismTaxonomy, manifest?: PhyloManifest | null) {
    const keys = enabledKeys(taxon, manifest ?? null);
    return cond.filter((k) => keys.has(k));
  }

  it("Hepatitis E virus (291484) — zero conditional", () => {
    expect(condEnabled(tax({ taxonId: 291484, lineageNames: ["Viruses", "Hepeviridae"], lineageIds: [10239, 291484] }))).toEqual([]);
  });

  it("SARS-CoV-2 (2697049) — zero conditional", () => {
    expect(condEnabled(tax({ taxonId: 2697049, lineageNames: ["Viruses", "Coronaviridae"], lineageIds: [10239, 2697049] }))).toEqual([]);
  });

  it("Dengue (12637) — SFVT only", () => {
    expect(condEnabled(tax({ taxonId: 12637, lineageNames: ["Viruses", "Flaviviridae"], lineageIds: [10239, 12637] }))).toEqual(["sfvt"]);
  });

  it("Monkeypox (10244) — SFVT only", () => {
    expect(condEnabled(tax({ taxonId: 10244, lineageNames: ["Viruses", "Poxviridae"], lineageIds: [10239, 10244] }))).toEqual(["sfvt"]);
  });

  it("Rift Valley fever (11588) — Strains only", () => {
    expect(condEnabled(tax({ taxonId: 11588, lineageNames: ["Viruses", "Bunyaviricetes", "Phenuiviridae"], lineageIds: [10239, 11588] }))).toEqual(["strains"]);
  });

  it("Influenza (2955291) — Phylogeny + Strains + Surveillance + Serology + SFVT", () => {
    const manifest: PhyloManifest = { trees: { "2955291": {} } };
    const result = condEnabled(
      tax({
        taxonId: 2955291,
        lineageNames: ["Viruses", "Orthomyxoviridae", "Alphainfluenzavirus influenzae"],
        lineageIds: [10239, 11308, 2955291],
      }),
      manifest,
    );
    expect(result).toEqual(["phylogeny", "strains", "surveillance", "serology", "sfvt"]);
  });

  it("E. coli (562) — bacteria cluster + phylogeny, no viral-only tabs", () => {
    const result = condEnabled(tax({ taxonId: 562, lineageNames: ["Bacteria", "Pseudomonadota"], lineageIds: [2, 562] }));
    expect(result).toEqual(["phylogeny", "amr-phenotypes", "interactions"]);
  });

  it("Mycobacterium genus (1763) — same bacterial set as a species (rank-independent)", () => {
    const result = condEnabled(tax({ taxonId: 1763, taxonRank: "genus", lineageNames: ["Bacteria", "Actinomycetota"], lineageIds: [2, 1763] }));
    expect(result).toEqual(["phylogeny", "amr-phenotypes", "interactions"]);
  });

  it("cellular organisms (131567) — bacterial cluster without phylogeny", () => {
    // The root's scope holds bacteria, but its own lineage has no "Bacteria",
    // so the Phylogeny view would open the viral viewer on a tree that does
    // not exist.
    const result = condEnabled(tax({ taxonId: 131567, taxonRank: "no rank", lineageNames: ["cellular organisms"], lineageIds: [131567] }));
    expect(result).toEqual(["amr-phenotypes", "interactions"]);
  });

  it("Fungi (4751) — baseline only (doc §7.5)", () => {
    expect(condEnabled(tax({ taxonId: 4751, lineageNames: ["Eukaryota", "Fungi"], lineageIds: [2759, 4751] }))).toEqual([]);
  });
});

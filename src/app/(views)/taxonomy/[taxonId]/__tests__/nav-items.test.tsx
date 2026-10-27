// src/app/(views)/taxonomy/[taxonId]/__tests__/nav-items.test.tsx
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import { buildTaxonomyConfig } from "../_config";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

function tax(over: Partial<OrganismTaxonomy>): OrganismTaxonomy {
  return { taxonId: 1, taxonName: "x", taxonRank: "species", lineageNames: [], lineageIds: [], genomes: 0, ...over };
}

function buildItems(taxon: OrganismTaxonomy) {
  return buildTaxonViews({
    config: buildTaxonomyConfig(taxon.taxonId, taxon),
    scope: { kind: "lineage", taxon },
    taxon,
    surface: "taxonomy",
  });
}

describe("buildTaxonomyNavItems", () => {
  it("returns all 16 tabs", () => {
    const taxon = tax({ lineageNames: ["Bacteria"] });
    const items = buildItems(taxon);
    expect(items).toHaveLength(16);
  });

  it("gives a bacterial taxon a real AMR Phenotypes table, not a placeholder", () => {
    const taxon = tax({ taxonId: 1386, lineageNames: ["Bacteria", "Bacillota"], lineageIds: [2, 1386] });
    const amr = buildItems(taxon).find((i) => i.key === "amr-phenotypes");
    expect(amr).toEqual(expect.objectContaining({ label: "AMR Phenotypes", layout: "fill" }));
    expect(amr?.enabled).toBe(true);
    expect(amr?.Component.name).toBe("AmrPhenotypesView");
  });

  it("enables interactions for a bacterial taxon", () => {
    const taxon = tax({ taxonId: 562, lineageNames: ["Bacteria", "Pseudomonadota"], lineageIds: [2, 562] });
    const items = buildItems(taxon);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.enabled !== false]));
    expect(byKey["interactions"]).toBe(true);
    expect(byKey["amr-phenotypes"]).toBe(true);
    expect(byKey["strains"]).toBe(false);
  });

  it("disables interactions (shown, not removed) for a viral taxon", () => {
    const taxon = tax({ taxonId: 11320, lineageNames: ["Viruses", "Orthomyxoviridae"], lineageIds: [10239, 11320] });
    const items = buildItems(taxon);
    const interactions = items.find((i) => i.key === "interactions");
    expect(interactions).toBeDefined();
    expect(interactions?.enabled).toBe(false);
    expect(interactions?.disabledReason).toMatch(/bacterial/i);
  });

  it("evaluates gates across every composite root", () => {
    const fungi = tax({ taxonId: 4751, lineageNames: ["Eukaryota", "Fungi"], lineageIds: [2759, 4751] });
    const influenza = tax({
      taxonId: 2955291,
      lineageNames: ["Viruses", "Orthomyxoviridae", "Alphainfluenzavirus influenzae"],
      lineageIds: [10239, 11308, 2955291],
    });
    const items = buildTaxonViews({
      config: buildTaxonomyConfig(fungi.taxonId, fungi),
      scope: { kind: "composite", displayName: "Composite", roots: [fungi, influenza] },
      taxon: fungi,
      surface: "landing",
    });
    const enabled = new Set(items.filter((item) => item.enabled !== false).map((item) => item.key));

    expect([...enabled]).toEqual(expect.arrayContaining([
      "strains", "surveillance", "serology", "sfvt",
    ]));
  });

  it("enables descendant-specific tabs for an all-organisms composite scope", () => {
    const cellular = tax({ taxonId: 131567, taxonName: "cellular organisms", lineageIds: [1, 131567] });
    const viruses = tax({ taxonId: 10239, taxonName: "Viruses", lineageNames: ["Viruses"], lineageIds: [1, 10239] });
    const items = buildTaxonViews({
      config: buildTaxonomyConfig(cellular.taxonId, cellular),
      scope: { kind: "composite", displayName: "All Organisms", roots: [cellular, viruses] },
      taxon: cellular,
      surface: "landing",
    });
    const enabled = new Set(items.filter((item) => item.enabled !== false).map((item) => item.key));

    expect([...enabled]).toEqual(expect.arrayContaining([
      "strains", "surveillance", "serology", "sfvt", "interactions",
    ]));
  });

  it("injects the real overview component (not a placeholder)", () => {
    const taxon = tax({ lineageNames: ["Bacteria"] });
    const items = buildItems(taxon);
    const overview = items.find((i) => i.key === "overview");
    expect(overview?.Component.name).not.toMatch(/PlaceholderView/);
    expect(overview?.Component.name).toBe("OverviewView");
  });

  it("injects the real data views (not placeholders)", () => {
    // resolveComponent returns the override Component regardless of gate state,
    // so any taxon surfaces the real named fn. Catches a dropped override
    // silently falling back to makePlaceholderView.
    const taxon = tax({ lineageNames: ["Bacteria"] });
    const items = buildItems(taxon);
    const name = (k: string) => items.find((i) => i.key === k)?.Component.name;
    expect(name("phylogeny")).toBe("PhylogenyView");
    expect(name("genomes")).toBe("GenomesView");
    expect(name("features")).toBe("FeaturesView");
    expect(name("domains-and-motifs")).toBe("DomainsAndMotifsView");
    expect(name("experiments")).toBe("ExperimentsView");
    expect(name("strains")).toBe("StrainsView");
    expect(name("surveillance")).toBe("SurveillanceView");
    expect(name("serology")).toBe("SerologyView");
    expect(name("sfvt")).toBe("SfvtView");
    expect(name("epitopes")).toBe("EpitopesView");
    expect(name("interactions")).toBe("InteractionsView");

    expect(items.find((item) => item.key === "overview")?.layout).toBeUndefined();
    expect(items.filter((item) => item.key !== "overview")).toEqual(
      expect.arrayContaining([expect.objectContaining({ layout: "fill" })]),
    );
    expect(items.filter((item) => item.key !== "overview").every((item) => item.layout === "fill")).toBe(true);
  });

  it("disables phylogeny only on landing surfaces and preserves a supplied overview", () => {
    const taxon = tax({ taxonId: 2, lineageNames: ["Bacteria"], lineageIds: [2] });
    const OverviewComponent = () => null;
    const options = {
      config: buildTaxonomyConfig(taxon.taxonId, taxon),
      scope: { kind: "lineage" as const, taxon },
      taxon,
      OverviewComponent,
    };

    const taxonomyViews = buildTaxonViews({ ...options, surface: "taxonomy" });
    const landingViews = buildTaxonViews({ ...options, surface: "landing" });

    expect(taxonomyViews.find((item) => item.key === "overview")?.Component).toBe(OverviewComponent);
    expect(taxonomyViews.find((item) => item.key === "phylogeny")?.enabled).not.toBe(false);
    expect(landingViews.find((item) => item.key === "phylogeny")).toMatchObject({
      enabled: false,
      disabledReason: "Phylogeny is available from taxonomy detail pages.",
    });
  });
});

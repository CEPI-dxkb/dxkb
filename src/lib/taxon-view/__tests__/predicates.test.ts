// src/lib/taxon-view/__tests__/predicates.test.ts
import { buildTabContext } from "../tab-context";
import type { PhyloManifest, TabContext } from "../tab-context";
import {
  hasBacterialOrViralPhylogeny,
  hasSerology,
  hasSfvt,
  hasStrains,
  hasSurveillance,
  hasViralTree,
  isArchaea,
  isBacteria,
  isFungi,
} from "../predicates";
import { getCuratedLists } from "../curated-lists";

function ctx(
  partial: {
    taxonId?: number;
    lineageNames?: string[];
    lineageIds?: number[];
    manifest?: PhyloManifest | null;
  } = {},
): TabContext {
  return {
    taxonomy: {
      taxonId: partial.taxonId ?? 1,
      lineageNames: partial.lineageNames ?? [],
      lineageIds: partial.lineageIds ?? [],
      scopeRootIds: [],
      scopeLineageNames: partial.lineageNames ?? [],
      scopeLineageIds: partial.lineageIds ?? [],
    },
    phyloManifest: partial.manifest ?? null,
    curatedLists: getCuratedLists(),
  };
}

describe("organism-kind predicates", () => {
  it("isBacteria true only when lineage contains 'Bacteria'", () => {
    expect(isBacteria(ctx({ lineageNames: ["Bacteria", "Brucella"] }))).toBe(true);
    expect(isBacteria(ctx({ lineageNames: ["Viruses"] }))).toBe(false);
  });
});

describe("hasBacterialOrViralPhylogeny", () => {
  const cellularOrganisms = buildTabContext(
    {
      taxonId: 131567,
      taxonName: "cellular organisms",
      taxonRank: "no rank",
      lineageNames: ["cellular organisms"],
      lineageIds: [131567],
      genomes: 0,
    },
    null,
    getCuratedLists(),
  );

  it("does not open a tree for the cellular root, which isBacteria covers by scope", () => {
    expect(isBacteria(cellularOrganisms)).toBe(true);
    expect(hasBacterialOrViralPhylogeny(cellularOrganisms)).toBe(false);
  });

  it("opens one for a taxon whose own lineage holds Bacteria", () => {
    expect(hasBacterialOrViralPhylogeny(ctx({ lineageNames: ["cellular organisms", "Bacteria"] }))).toBe(true);
  });
});

describe("hasStrains (segmented viruses) — the Lassa vs RVFV canary (doc §5)", () => {
  it("RVFV (class Bunyaviricetes) → true", () => {
    // Rift Valley fever: lineage runs through the CLASS Bunyaviricetes.
    expect(
      hasStrains(
        ctx({
          taxonId: 11588,
          lineageNames: ["Viruses", "Bunyaviricetes", "Hareavirales", "Phenuiviridae"],
        }),
      ),
    ).toBe(true);
  });

  it("Lassa (order Bunyavirales, class Ellioviricetes) → false", () => {
    // Lassa sits under the ORDER Bunyavirales, NOT the class Bunyaviricetes.
    expect(
      hasStrains(
        ctx({
          taxonId: 11620,
          lineageNames: ["Viruses", "Ellioviricetes", "Bunyavirales", "Arenaviridae"],
        }),
      ),
    ).toBe(false);
  });

  it("Orthomyxoviridae (influenza) → true", () => {
    expect(hasStrains(ctx({ lineageNames: ["Viruses", "Orthomyxoviridae"] }))).toBe(true);
  });
});

describe("hasSfvt (curated, by lineage id, inherits)", () => {
  it("true when any lineage id is on the curated SFVT list", () => {
    expect(hasSfvt(ctx({ lineageIds: [10239, 12637] }))).toBe(true); // 10239 = Viruses root, 12637 = Dengue (the SFVT-bearing id)
  });
  it("inherits to a descendant whose ancestor id is listed", () => {
    expect(hasSfvt(ctx({ taxonId: 99999, lineageIds: [10239, 12637, 99999] }))).toBe(true);
  });
  it("false when no lineage id is listed", () => {
    expect(hasSfvt(ctx({ lineageIds: [10239, 694009] }))).toBe(false); // SARS-CoV-2 family
  });
});

describe("hasSurveillance / hasSerology (curated, by lineage name)", () => {
  it("true for the influenza cohort name", () => {
    const c = ctx({ lineageNames: ["Viruses", "Orthomyxoviridae", "Alphainfluenzavirus influenzae"] });
    expect(hasSurveillance(c)).toBe(true);
    expect(hasSerology(c)).toBe(true);
  });
  it("false for a non-cohort virus", () => {
    const c = ctx({ lineageNames: ["Viruses", "Coronaviridae"] });
    expect(hasSurveillance(c)).toBe(false);
    expect(hasSerology(c)).toBe(false);
  });
});

describe("hasViralTree (data availability, exact id, NO inheritance)", () => {
  it("true when the exact taxon_id keys the manifest", () => {
    const manifest: PhyloManifest = { trees: { "2955291": {} } };
    expect(hasViralTree(ctx({ taxonId: 2955291, manifest }))).toBe(true);
  });
  it("does NOT inherit — a species does not get its family's tree", () => {
    const manifest: PhyloManifest = { trees: { "11308": {} } }; // family present
    expect(hasViralTree(ctx({ taxonId: 2955291, manifest }))).toBe(false);
  });
  it("false when manifest is null (fail-open)", () => {
    expect(hasViralTree(ctx({ taxonId: 2955291, manifest: null }))).toBe(false);
  });
});

describe("buildTabContext", () => {
  it("maps an OrganismTaxonomy + manifest + lists into a TabContext", () => {
    const built = buildTabContext(
      {
        taxonId: 234,
        taxonName: "Brucella",
        taxonRank: "genus",
        lineageNames: ["Bacteria", "Brucella"],
        lineageIds: [2, 234],
        genomes: 1,
      },
      null,
      getCuratedLists(),
    );
    expect(built.taxonomy.taxonId).toBe(234);
    expect(built.taxonomy.lineageNames).toEqual(["Bacteria", "Brucella"]);
    expect(built.phyloManifest).toBeNull();
  });

  it("tolerates a null taxon (empty lineage)", () => {
    const built = buildTabContext(null, null, getCuratedLists());
    expect(built.taxonomy.lineageNames).toEqual([]);
    expect(built.taxonomy.lineageIds).toEqual([]);
  });
});

describe("kingdom predicates — fungi and archaea", () => {
  it("isFungi true when lineage contains 'Fungi'", () => {
    expect(isFungi(ctx({ lineageNames: ["Eukaryota", "Fungi", "Ascomycota", "Candida"] }))).toBe(true);
    expect(isFungi(ctx({ lineageNames: ["Bacteria"] }))).toBe(false);
    expect(isFungi(ctx({ lineageNames: ["Viruses"] }))).toBe(false);
    expect(isFungi(ctx({ lineageNames: [] }))).toBe(false);
  });

  it("isArchaea true when lineage contains 'Archaea'", () => {
    expect(isArchaea(ctx({ lineageNames: ["Archaea", "Euryarchaeota"] }))).toBe(true);
    expect(isArchaea(ctx({ lineageNames: ["Bacteria"] }))).toBe(false);
    expect(isArchaea(ctx({ lineageNames: ["Eukaryota", "Fungi"] }))).toBe(false);
    expect(isArchaea(ctx({ lineageNames: [] }))).toBe(false);
  });

  it("isFungi and isArchaea are mutually exclusive with isBacteria", () => {
    const fungalCtx = ctx({ lineageNames: ["Eukaryota", "Fungi"] });
    expect(isBacteria(fungalCtx)).toBe(false);
    expect(isFungi(fungalCtx)).toBe(true);

    const archaealCtx = ctx({ lineageNames: ["Archaea"] });
    expect(isBacteria(archaealCtx)).toBe(false);
    expect(isArchaea(archaealCtx)).toBe(true);
  });
});

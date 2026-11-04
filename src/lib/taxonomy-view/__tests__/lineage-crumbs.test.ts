import {
  breadcrumbIndexes,
  breadcrumbRanks,
  lineageCrumbs,
  taxonViewCrumbs,
  taxonViewHeader,
} from "../lineage-crumbs";

// Live BV-BRC `lineage_ranks` for E. coli K-12 (taxon 83333), 2026-10-28.
const ecoliK12 = {
  lineageIds: [131567, 2, 3379134, 1224, 1236, 91347, 543, 561, 562, 83333],
  lineageNames: [
    "cellular organisms",
    "Bacteria",
    "Pseudomonadati",
    "Pseudomonadota",
    "Gammaproteobacteria",
    "Enterobacterales",
    "Enterobacteriaceae",
    "Escherichia",
    "Escherichia coli",
    "Escherichia coli K-12",
  ],
  lineageRanks: [
    "cellular root",
    "domain",
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
    "species",
    "strain",
  ],
};

// Live lineage for Influenza A virus (A/California/07/2009(H1N1)), 641809.
const h1n1 = {
  lineageIds: [
    10239, 2559587, 2732396, 2497569, 2497571, 2497577, 2499411, 11308,
    197911, 2955291, 11320, 114727, 641809,
  ],
  lineageNames: [
    "Viruses",
    "Riboviria",
    "Orthornavirae",
    "Negarnaviricota",
    "Polyploviricotina",
    "Insthoviricetes",
    "Articulavirales",
    "Orthomyxoviridae",
    "Alphainfluenzavirus",
    "Alphainfluenzavirus influenzae",
    "Influenza A virus",
    "H1N1 subtype",
    "Influenza A virus (A/California/07/2009(H1N1))",
  ],
  lineageRanks: [
    "acellular root",
    "realm",
    "kingdom",
    "phylum",
    "subphylum",
    "class",
    "order",
    "family",
    "genus",
    "species",
    "no rank",
    "serotype",
    "no rank",
  ],
};

describe("lineageCrumbs", () => {
  it("keeps only the ranks BV-BRC's Genome and Feature Views show", () => {
    expect(
      lineageCrumbs({
        lineage_ids: [10239, 2559587, 2497569, 2497571, 2497577, 11308, 11320],
        lineage_names: [
          "Viruses",
          "Riboviria",
          "Negarnaviricota",
          "Polyploviricotina",
          "Insthoviricetes",
          "Orthomyxoviridae",
          "Influenza A virus",
        ],
        lineage_ranks: [
          "acellular root",
          "realm",
          "phylum",
          "subphylum",
          "class",
          "family",
          "no rank",
        ],
      }),
    ).toEqual([
      { taxonId: "2497569", name: "Negarnaviricota" },
      { taxonId: "2497577", name: "Insthoviricetes" },
      { taxonId: "11308", name: "Orthomyxoviridae" },
    ]);
  });

  it("skips a taxon without a usable id or name", () => {
    expect(
      lineageCrumbs({
        lineage_ids: ["", "561", "562"],
        lineage_names: ["Enterobacteriaceae", "Escherichia", " "],
        lineage_ranks: ["family", "genus", "species"],
      }),
    ).toEqual([{ taxonId: "561", name: "Escherichia" }]);
  });

  it("shows no lineage for a record without ranks", () => {
    expect(
      lineageCrumbs({
        lineage_ids: ["561"],
        lineage_names: ["Escherichia"],
      }),
    ).toEqual([]);
  });
});

describe("lineageCrumbs on a malformed record", () => {
  it("shows nothing when the names or ids are one short", () => {
    const record = {
      lineage_ids: ecoliK12.lineageIds,
      lineage_names: ecoliK12.lineageNames,
      lineage_ranks: ecoliK12.lineageRanks,
    };
    expect(
      lineageCrumbs({ ...record, lineage_names: record.lineage_names.slice(1) }),
    ).toEqual([]);
    expect(
      lineageCrumbs({ ...record, lineage_ids: record.lineage_ids.slice(1) }),
    ).toEqual([]);
  });
});

describe("breadcrumbRanks", () => {
  it("is BV-BRC's visibleRanks verbatim, including the retired superkingdom", () => {
    expect([...breadcrumbRanks]).toEqual([
      "superkingdom",
      "phylum",
      "class",
      "order",
      "family",
      "genus",
      "species",
    ]);
  });
});

describe("breadcrumbIndexes", () => {
  it("keeps whitelisted ranks in lineage order", () => {
    expect(
      breadcrumbIndexes(ecoliK12.lineageRanks, { withLeaf: false }),
    ).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("appends an unranked leaf only when asked", () => {
    expect(
      breadcrumbIndexes(ecoliK12.lineageRanks, { withLeaf: true }),
    ).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("does not append a leaf that is already whitelisted", () => {
    expect(
      breadcrumbIndexes(ecoliK12.lineageRanks.slice(0, 9), { withLeaf: true }),
    ).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("appends no leaf when no rank is whitelisted (BV-BRC's undefined < n)", () => {
    expect(
      breadcrumbIndexes(["cellular root", "domain"], { withLeaf: true }),
    ).toEqual([]);
    expect(
      breadcrumbIndexes(["cellular root", "domain", "kingdom"], {
        withLeaf: true,
      }),
    ).toEqual([]);
  });

  it("points a repeated rank at its first occurrence, like indexOf", () => {
    expect(
      breadcrumbIndexes(["phylum", "class", "class", "genus"], {
        withLeaf: false,
      }),
    ).toEqual([0, 1, 1, 3]);
  });

  it("still honours superkingdom on records that carry it", () => {
    expect(
      breadcrumbIndexes(["superkingdom", "phylum"], { withLeaf: false }),
    ).toEqual([0, 1]);
  });

  it("returns nothing for an empty lineage", () => {
    expect(breadcrumbIndexes([], { withLeaf: true })).toEqual([]);
  });
});

describe("lineageCrumbs (Genome and Feature Views)", () => {
  it("never appends the record's own unranked taxon", () => {
    expect(
      lineageCrumbs({
        lineage_ids: ecoliK12.lineageIds,
        lineage_names: ecoliK12.lineageNames,
        lineage_ranks: ecoliK12.lineageRanks,
      }).map(({ name }) => name),
    ).toEqual([
      "Pseudomonadota",
      "Gammaproteobacteria",
      "Enterobacterales",
      "Enterobacteriaceae",
      "Escherichia",
      "Escherichia coli",
    ]);
  });
});

describe("taxonViewCrumbs (Taxon View)", () => {
  it("ends with the taxon itself when its rank is not whitelisted", () => {
    expect(taxonViewCrumbs(ecoliK12)).toEqual([
      { taxonId: "1224", name: "Pseudomonadota" },
      { taxonId: "1236", name: "Gammaproteobacteria" },
      { taxonId: "91347", name: "Enterobacterales" },
      { taxonId: "543", name: "Enterobacteriaceae" },
      { taxonId: "561", name: "Escherichia" },
      { taxonId: "562", name: "Escherichia coli" },
      { taxonId: "83333", name: "Escherichia coli K-12" },
    ]);
  });

  it("drops unranked and serotype ancestors but keeps the leaf", () => {
    expect(taxonViewCrumbs(h1n1).map(({ name }) => name)).toEqual([
      "Negarnaviricota",
      "Insthoviricetes",
      "Articulavirales",
      "Orthomyxoviridae",
      "Alphainfluenzavirus",
      "Alphainfluenzavirus influenzae",
      "Influenza A virus (A/California/07/2009(H1N1))",
    ]);
  });

  it("is empty for a domain, as on BV-BRC's Bacteria page", () => {
    expect(
      taxonViewCrumbs({
        lineageIds: [131567, 2],
        lineageNames: ["cellular organisms", "Bacteria"],
        lineageRanks: ["cellular root", "domain"],
      }),
    ).toEqual([]);
  });

  it("is empty when the record has no ranks", () => {
    expect(
      taxonViewCrumbs({ lineageIds: [561], lineageNames: ["Escherichia"] }),
    ).toEqual([]);
  });

  it("shows nothing when the parsed lineage arrays no longer line up", () => {
    // fetchOrganismTaxonomy drops a malformed id or name but keeps every
    // rank, which would shift each later rank onto the wrong taxon.
    expect(
      taxonViewCrumbs({
        ...ecoliK12,
        lineageIds: ecoliK12.lineageIds.filter((id) => id !== 1224),
      }),
    ).toEqual([]);
    expect(
      taxonViewCrumbs({
        ...ecoliK12,
        lineageNames: ecoliK12.lineageNames.slice(1),
      }),
    ).toEqual([]);
  });
});

describe("taxonViewHeader", () => {
  it("separates the ancestors from the taxon's own crumb", () => {
    const header = taxonViewHeader({ taxonId: 83333, ...ecoliK12 });
    expect(header.headingHidden).toBe(false);
    expect(header.ancestors.map(({ taxonId }) => taxonId)).toEqual([
      "1224",
      "1236",
      "91347",
      "543",
      "561",
      "562",
    ]);
  });

  it("keeps every crumb as an ancestor when the lineage ends at the parent", () => {
    const header = taxonViewHeader({
      taxonId: 83333,
      lineageIds: ecoliK12.lineageIds.slice(0, 9),
      lineageNames: ecoliK12.lineageNames.slice(0, 9),
      lineageRanks: ecoliK12.lineageRanks.slice(0, 9),
    });
    expect(header.ancestors.at(-1)).toEqual({
      taxonId: "562",
      name: "Escherichia coli",
    });
    expect(header.headingHidden).toBe(false);
  });

  it("keeps every crumb as an ancestor when the leaf id is 0", () => {
    const header = taxonViewHeader({
      taxonId: 83333,
      ...ecoliK12,
      lineageIds: [...ecoliK12.lineageIds.slice(0, 9), 0],
    });
    expect(header.ancestors.at(-1)?.taxonId).toBe("562");
    expect(header.headingHidden).toBe(false);
  });

  it("keeps every crumb as an ancestor when the leaf name is blank", () => {
    const header = taxonViewHeader({
      taxonId: 83333,
      ...ecoliK12,
      lineageNames: [...ecoliK12.lineageNames.slice(0, 9), " "],
    });
    expect(header.ancestors.at(-1)?.taxonId).toBe("562");
    expect(header.headingHidden).toBe(false);
  });

  it("hides the heading only for a ranked lineage with no shown rank", () => {
    expect(
      taxonViewHeader({
        taxonId: 2,
        lineageIds: [131567, 2],
        lineageNames: ["cellular organisms", "Bacteria"],
        lineageRanks: ["cellular root", "domain"],
      }),
    ).toEqual({ ancestors: [], headingHidden: true });
  });

  it("keeps the heading visible without ranks or with misaligned arrays", () => {
    const base = { taxonId: 561, lineageIds: [561], lineageNames: ["Escherichia"] };
    expect(taxonViewHeader(base).headingHidden).toBe(false);
    expect(taxonViewHeader({ ...base, lineageRanks: [] }).headingHidden).toBe(
      false,
    );
    expect(
      taxonViewHeader({ taxonId: 83333, ...ecoliK12, lineageIds: [1, 2] }),
    ).toEqual({ ancestors: [], headingHidden: false });
  });
});

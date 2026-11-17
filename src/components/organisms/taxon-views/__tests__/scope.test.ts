import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import {
  scopeRoots,
  taxonGenomesClause,
  taxonIdsGenomesClause,
  taxonIdsLineageClause,
  taxonLineageClause,
} from "../scope";

function taxon(taxonId: number): OrganismTaxonomy {
  return {
    taxonId,
    taxonName: String(taxonId),
    lineageIds: [taxonId],
    lineageNames: [],
    taxonRank: "no rank",
    genomes: null,
  };
}

describe("taxonLineageClause", () => {
  it("preserves the single-lineage query shape", () => {
    expect(taxonLineageClause({ kind: "lineage", taxon: taxon(2) })).toBe(
      "eq(taxon_lineage_ids,2)",
    );
  });

  it("includes cellular organisms and viruses in the all-organisms scope", () => {
    expect(
      taxonLineageClause({
        kind: "composite",
        displayName: "All Organisms",
        roots: [taxon(131567), taxon(10239)],
      }),
    ).toBe("or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239))");
  });

  it("preserves root order and duplicate roots", () => {
    const first = taxon(10239);
    const second = taxon(131567);
    const roots = [first, second, first];
    const scope = { kind: "composite" as const, displayName: "Composite", roots };

    expect(scopeRoots(scope)).toBe(roots);
    expect(taxonLineageClause(scope)).toBe(
      "or(eq(taxon_lineage_ids,10239),eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239))",
    );
  });

  it("returns the lineage taxon as the sole root", () => {
    const root = taxon(2);
    expect(scopeRoots({ kind: "lineage", taxon: root })).toEqual([root]);
  });

  it("rejects an empty composite before producing invalid RQL", () => {
    const scope = { kind: "composite" as const, displayName: "Empty", roots: [] };
    expect(() => scopeRoots(scope)).toThrow(/at least one root taxon/i);
    expect(() => taxonLineageClause(scope)).toThrow(/at least one root taxon/i);
  });
});

describe("taxonGenomesClause", () => {
  it("leaves Deprecated genomes out of a lineage, as legacy's Taxonomy view does", () => {
    expect(taxonGenomesClause({ kind: "lineage", taxon: taxon(11320) })).toBe(
      "and(eq(taxon_lineage_ids,11320),ne(genome_status,Deprecated))",
    );
  });

  it("applies the filter to every root of a composite scope", () => {
    expect(
      taxonGenomesClause({
        kind: "composite",
        displayName: "All Organisms",
        roots: [taxon(131567), taxon(10239)],
      }),
    ).toBe(
      "and(or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239)),ne(genome_status,Deprecated))",
    );
  });
});

describe("taxonIdsLineageClause", () => {
  it("is a bare eq for one id", () => {
    expect(taxonIdsLineageClause([2])).toBe("eq(taxon_lineage_ids,2)");
  });

  it("joins several ids with or, in order", () => {
    expect(taxonIdsLineageClause([131567, 10239])).toBe(
      "or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239))",
    );
  });

  it("rejects an empty list before producing invalid RQL", () => {
    expect(() => taxonIdsLineageClause([])).toThrow(/at least one taxon id/i);
  });

  it("matches taxonLineageClause for the same roots", () => {
    const roots = [taxon(131567), taxon(10239)];
    expect(
      taxonIdsLineageClause(roots.map((root) => root.taxonId)),
    ).toBe(
      taxonLineageClause({ kind: "composite", displayName: "All", roots }),
    );
    expect(taxonIdsLineageClause([2])).toBe(
      taxonLineageClause({ kind: "lineage", taxon: taxon(2) }),
    );
  });
});

describe("taxonIdsGenomesClause", () => {
  it("leaves Deprecated genomes out of one id", () => {
    expect(taxonIdsGenomesClause([11320])).toBe(
      "and(eq(taxon_lineage_ids,11320),ne(genome_status,Deprecated))",
    );
  });

  it("applies the filter to every id, as the All Organisms Genomes tab does", () => {
    const ids = [131567, 10239];
    expect(taxonIdsGenomesClause(ids)).toBe(
      "and(or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239)),ne(genome_status,Deprecated))",
    );
    expect(taxonIdsGenomesClause(ids)).toBe(
      taxonGenomesClause({
        kind: "composite",
        displayName: "All Organisms",
        roots: ids.map(taxon),
      }),
    );
  });
});

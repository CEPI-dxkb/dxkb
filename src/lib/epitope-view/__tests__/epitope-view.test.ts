import {
  epitopeAssayRql,
  epitopeCollectionProfile,
  epitopeStructuralRql,
  epitopeViewRecordSchema,
  isEpitopeId,
  parseEpitopeCollectionState,
  parseEpitopeTab,
} from "@/lib/epitope-view";

describe("Epitope view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseEpitopeCollectionState({}).sort).toBe("unsorted");
    expect(parseEpitopeCollectionState({ sort: "epitope_id:asc" }).sort).toBe(
      "epitope_id:asc",
    );
  });

  it("validates identifiers and overview fields", () => {
    expect(isEpitopeId("15780")).toBe(true);
    expect(isEpitopeId("")).toBe(false);
    expect(epitopeViewRecordSchema.parse({ epitope_id: "15780", total_assays: 2, assay_results: ["Positive"], host_name: ["Mus musculus BALB/c"] })).toMatchObject({ epitope_id: "15780", total_assays: 2 });
  });

  it("parses collection state and maps taxon scope to lineage", () => {
    const state = parseEpitopeCollectionState({ keyword: "influenza", taxon_id: "11520", epitope_type: ["Linear peptide", "Discontinuous peptide"], page: "2" });
    expect(state.page).toBe(2);
    expect(epitopeStructuralRql(state)).toBe('and(eq(taxon_lineage_ids,11520),or(eq(epitope_type,"Linear%20peptide"),eq(epitope_type,"Discontinuous%20peptide")))');
  });

  it("keeps friendly filters beside explicit RQL and rejects transport operators", () => {
    const state = parseEpitopeCollectionState({ taxon_id: "11520", rql: "eq(epitope_type,B-cell)" });
    expect(state.filters).toEqual({ taxon_id: ["11520"] });
    expect(epitopeStructuralRql(state)).toBe("eq(taxon_lineage_ids,11520)");
    expect(() => parseEpitopeCollectionState({ rql: "sort(+epitope_id)" })).toThrow("Transport operator");
  });

  it("uses canonical member links and exact assay scope", () => {
    expect(epitopeCollectionProfile.rowHref?.({ epitope_id: "15/780" })).toBe("/epitope/15%2F780");
    expect(epitopeCollectionProfile.rowLinkField).toBe("epitope_id");
    expect(epitopeCollectionProfile.basePredicate).toBe("eq(epitope_id,*)");
    expect(epitopeAssayRql("15780")).toBe("eq(epitope_id,15780)");
  });

  it("canonicalizes member tabs", () => {
    expect(parseEpitopeTab(undefined)).toBe("overview");
    expect(parseEpitopeTab("assays")).toBe("assays");
    expect(parseEpitopeTab(["assays", "overview"])).toBe("assays");
    expect(parseEpitopeTab("missing")).toBe("overview");
  });
});

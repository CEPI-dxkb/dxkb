import {
  buildFeatureTabs,
  canonicalFeatureTab,
  featureBaseRql,
  featureCollectionProfile,
  featureStructuralRql,
  featureViewRecordSchema,
  isFeatureId,
  isPatricFeatureId,
  parseFeatureCollectionState,
  recentGenomeFeatureRql,
} from "@/lib/feature-view";
import {
  featureDomainsRql,
  featureInteractionsRql,
  genomeProteinRql,
} from "@/lib/views/child-resources";

describe("Feature view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseFeatureCollectionState({}).sort).toBe("unsorted");
    expect(parseFeatureCollectionState({ sort: "patric_id:asc" }).sort).toBe(
      "patric_id:asc",
    );
  });

  it("uses the legacy recent, non-deprecated Genome scope for the global list", () => {
    expect(recentGenomeFeatureRql).toBe(
      "and(eq(genome_id,*),genome(and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))))",
    );
    expect(
      featureBaseRql({ keyword: "", filters: {}, page: 1, sort: "unsorted" }),
    ).toBe(recentGenomeFeatureRql);
  });

  it("does not restrict an explicit RQL query to recently completed genomes", () => {
    expect(
      featureBaseRql({
        keyword: "",
        filters: {},
        page: 1,
        sort: "unsorted",
        rql: "and(eq(genome_id,*),genome(eq(taxon_lineage_ids,120577)))",
      }),
    ).toBeUndefined();
  });

  it("accepts canonical and alternate complex identifiers", () => {
    expect(isFeatureId("PATRIC.83332.12.NC_000962.CDS.1.1524.fwd")).toBe(true);
    expect(isFeatureId("fig|83332.12.peg.1")).toBe(true);
    expect(isPatricFeatureId("fig|83332.12.peg.1")).toBe(true);
    expect(isPatricFeatureId("PATRIC.83332.12.peg.1")).toBe(false);
  });

  it("validates member fields and corrected codon_start metadata", () => {
    expect(
      featureViewRecordSchema.parse({
        feature_id: "PATRIC.1",
        codon_start: 1,
        gene_id: 0,
      }),
    ).toMatchObject({ feature_id: "PATRIC.1", codon_start: 1, gene_id: 0 });
    expect(featureCollectionProfile.basePredicate).toBe("eq(feature_id,*)");
    expect(featureCollectionProfile.detailFields).toContain("codon_start");
    expect(featureCollectionProfile.detailFields).not.toContain("Codon Start");
  });

  it("parses collection state without silently adding annotation", () => {
    const state = parseFeatureCollectionState({
      genome_id: "83332.12",
      feature_type: ["CDS", "tRNA"],
    });
    expect(state.filters).toEqual({
      genome_id: ["83332.12"],
      feature_type: ["CDS", "tRNA"],
    });
    expect(featureStructuralRql(state)).toBe(
      "and(eq(genome_id,83332.12),or(eq(feature_type,CDS),eq(feature_type,tRNA)))",
    );
  });

  it("keeps Feature filter separate from explicit structural RQL", () => {
    const state = parseFeatureCollectionState({
      rql: "eq(genome_id,83332.12)",
      filter: "protein",
    });
    expect(state.rql).toBe("eq(genome_id,83332.12)");
    expect(state.filters).toEqual({ filter: ["protein"] });
    expect(featureStructuralRql(state)).toContain("eq(annotation,PATRIC)");
  });

  it("builds exact protein and interaction predicates", () => {
    expect(genomeProteinRql("83332.12")).toBe(
      "and(eq(genome_id,83332.12),or(eq(feature_type,CDS),eq(feature_type,mat_peptide)),eq(annotation,PATRIC))",
    );
    expect(featureInteractionsRql("PATRIC.1")).toBe(
      "and(or(eq(feature_id_a,PATRIC.1),eq(feature_id_b,PATRIC.1)),eq(evidence,experimental))",
    );
    expect(featureDomainsRql("PATRIC.1")).toBe("eq(feature_id,PATRIC.1)");
  });

  it("enables only established member tabs", () => {
    const feature = featureViewRecordSchema.parse({ feature_id: "PATRIC.1" });
    expect(
      buildFeatureTabs(feature).find((tab) => tab.key === "interactions")
        ?.enabled,
    ).not.toBe(false);
    expect(canonicalFeatureTab("interactions", feature)).toBe("interactions");
    expect(canonicalFeatureTab("domains", feature)).toBe("domains");
    expect(canonicalFeatureTab("genome-browser", feature)).toBe("overview");
    expect(canonicalFeatureTab("unknown", feature)).toBe("overview");
  });
});

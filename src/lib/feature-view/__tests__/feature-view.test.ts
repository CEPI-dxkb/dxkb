import {
  buildFeatureTabs,
  canonicalFeatureTab,
  featureCollectionOptions,
  featureCollectionProfile,
  featureListCollectionOptions,
  featureListOptionsFor,
  featureStructuralRql,
  featureViewRecordSchema,
  isFeatureId,
  isPatricFeatureId,
  parseFeatureCollectionState,
  parseFeatureListState,
} from "@/lib/feature-view";
import {
  featureDomainsRql,
  featureInteractionsRql,
  genomeProteinRql,
  proteinFeatureRql,
} from "@/lib/views/child-resources";
import {
  facetCountState,
  serializeCollectionState,
} from "@/lib/views/collection-state";

describe("Feature view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseFeatureCollectionState({}).sort).toBe("unsorted");
    expect(parseFeatureCollectionState({ sort: "patric_id:asc" }).sort).toBe(
      "patric_id:asc",
    );
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

describe("Feature list URL schema", () => {
  // Legacy FeatureList: `keyword(Dnak)&and(eq(annotation,"PATRIC"))` returns
  // 2,122,831 rows; with the PATRIC value removed, 3,005,987 (alpha, 2026-10-05).
  it("selects legacy FeatureList's annotation=PATRIC default", () => {
    const state = parseFeatureCollectionState(
      { keyword: "Dnak" },
      featureListCollectionOptions,
    );
    expect(state.filters).toEqual({ annotation: ["PATRIC"] });
    expect(featureStructuralRql(state)).toBe("eq(annotation,PATRIC)");
    expect(
      serializeCollectionState(state, featureListCollectionOptions).toString(),
    ).toBe("keyword=Dnak");
  });

  it("lists every annotation once the default is removed", () => {
    const state = parseFeatureCollectionState(
      { keyword: "Dnak", annotation: "*" },
      featureListCollectionOptions,
    );
    expect(state.filters).toEqual({});
    expect(featureStructuralRql(state)).toBeUndefined();
    expect(
      serializeCollectionState(state, featureListCollectionOptions).toString(),
    ).toBe("keyword=Dnak&annotation=*");
  });

  it("counts facets over the scope filter alone while the default is untouched", () => {
    // `filter=CDS` is an independent scope, not something the user picked: the
    // annotation facet still counts the values the PATRIC default hides.
    const state = parseFeatureCollectionState(
      { keyword: "Dnak", filter: "CDS" },
      featureListCollectionOptions,
    );
    expect(featureStructuralRql(state)).toBe(
      "and(eq(annotation,PATRIC),eq(feature_type,CDS))",
    );
    expect(
      featureStructuralRql(facetCountState(state, featureListCollectionOptions)),
    ).toBe("eq(feature_type,CDS)");
  });

  it("replaces the default with a chosen annotation", () => {
    expect(
      parseFeatureCollectionState(
        { annotation: "RefSeq" },
        featureListCollectionOptions,
      ).filters,
    ).toEqual({ annotation: ["RefSeq"] });
  });

  it("gives the Proteins search no removable default", () => {
    // `proteinFeatureRql` already pins eq(annotation,PATRIC): removing a PATRIC
    // chip there would change nothing. Legacy ProteinList's removal
    // (#filter=false) sends the same query too, 2,122,451 rows for Dnak.
    for (const filter of ["protein", '"protein"']) {
      const state = parseFeatureListState({ keyword: "Dnak", filter });
      const options = featureListOptionsFor(state);
      expect(state.filters).toEqual({ filter: ["protein"] });
      expect(featureStructuralRql(state)).toBe(proteinFeatureRql);
      expect(options.defaultFilters).toBeUndefined();
      expect(serializeCollectionState(state, options).toString()).toBe(
        "keyword=Dnak&filter=protein",
      );
    }
    const features = parseFeatureListState({ keyword: "Dnak", filter: "CDS" });
    expect(features.filters).toEqual({
      annotation: ["PATRIC"],
      filter: ["CDS"],
    });
    expect(featureListOptionsFor(features)).toBe(featureListCollectionOptions);
  });

  it("keeps the default beside an explicit RQL that does not pick an annotation", () => {
    // Alpha's FeatureList/?eq(genome_id,83332.12) lists the genome's 5,425
    // PATRIC features, not all 10,940; the Genome overview's CDS count links
    // here and counts PATRIC CDS (4,367 of 8,356).
    const linked = parseFeatureListState({
      rql: "and(eq(genome_id,83332.12),eq(feature_type,CDS))",
    });
    expect(linked.filters).toEqual({ annotation: ["PATRIC"] });
    expect(featureStructuralRql(linked)).toBe("eq(annotation,PATRIC)");
    const removed = parseFeatureListState({
      rql: "eq(genome_id,83332.12)",
      annotation: "*",
    });
    expect(removed.filters).toEqual({});
    expect(featureStructuralRql(removed)).toBeUndefined();
  });

  it("applies the default beside an RQL and a feature-type scope", () => {
    const state = parseFeatureListState({
      rql: "eq(genome_id,83332.12)",
      filter: "CDS",
    });
    expect(state.filters).toEqual({ annotation: ["PATRIC"], filter: ["CDS"] });
    expect(featureStructuralRql(state)).toBe(
      "and(eq(annotation,PATRIC),eq(feature_type,CDS))",
    );
  });

  it("reads the validated RQL to see whether it picks an annotation", () => {
    // The parser accepts a space after `(`; the default must still give way,
    // or PATRIC and RefSeq together list 0 rows behind a stuck chip.
    const state = parseFeatureListState({
      rql: "and(eq(genome_id,83332.12),eq( annotation,RefSeq))",
    });
    expect(state.rql).toBe("and(eq(genome_id,83332.12),eq(annotation,RefSeq))");
    expect(state.filters).toEqual({});
  });

  it("lets an RQL that picks an annotation replace the default", () => {
    // DXKB's sequence and taxon FEATURES links pin eq(annotation,PATRIC).
    const state = parseFeatureListState({
      rql: "and(eq(sequence_id,NC_000962),eq(annotation,PATRIC),eq(feature_type,CDS))",
    });
    expect(state.filters).toEqual({});
    expect(featureStructuralRql(state)).toBeUndefined();
  });

  it("leaves the embedded schema without the default", () => {
    expect(parseFeatureCollectionState({}).filters).toEqual({});
    expect(
      parseFeatureCollectionState({ rql: "eq(genome_id,83332.12)" }).filters,
    ).toEqual({});
    expect(featureCollectionOptions.defaultFilters).toBeUndefined();
  });
});

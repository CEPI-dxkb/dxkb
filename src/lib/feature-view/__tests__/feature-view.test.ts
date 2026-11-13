import {
  buildFeatureTabs,
  canonicalFeatureTab,
  featureCollectionOptions,
  featureCollectionProfile,
  featureCompareRegionPeg,
  featureGenomeBrowserTarget,
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
    const located = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      genome_id: "1328357.3",
      accession: "ATGO01000001",
      start: 9610,
      end: 10707,
    });
    expect(canonicalFeatureTab("genome-browser", located)).toBe("genome-browser");
    expect(canonicalFeatureTab("genomeBrowser", located)).toBe("genome-browser");
    expect(canonicalFeatureTab("unknown", feature)).toBe("overview");
  });

  it("opens the Genome Browser exactly when its tab is enabled", () => {
    const location = { accession: "ATGO01000001", start: 9610, end: 10707 };
    const cases = [
      { feature_id: "PATRIC.1", genome_id: "1328357.3", ...location },
      { feature_id: "PATRIC.1", genome_id: "1328357.3" },
      { feature_id: "PATRIC.1", genome_id: "1328357.3", ...location, end: 5 },
      { feature_id: "PATRIC.1", ...location },
    ].map((record) => featureViewRecordSchema.parse(record));
    const [located, ...unlocated] = cases;

    expect(featureGenomeBrowserTarget(located)).toEqual({
      genomeId: "1328357.3",
      focus: {
        location: "ATGO01000001:6610..13707",
        highlight: "ATGO01000001:9610..10707",
      },
    });
    for (const record of unlocated) {
      expect(featureGenomeBrowserTarget(record)).toBeNull();
    }
    for (const record of cases) {
      expect(
        buildFeatureTabs(record).find((tab) => tab.key === "genome-browser")
          ?.enabled,
      ).toBe(featureGenomeBrowserTarget(record) !== null);
    }
  });
  it("opens the Compare Region Viewer for a CDS with a BRC ID, as legacy did", () => {
    const cds = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      feature_type: "CDS",
      patric_id: "fig|1.1.peg.1",
    });
    expect(featureCompareRegionPeg(cds)).toBe("fig|1.1.peg.1");
    expect(canonicalFeatureTab("compare-region", cds)).toBe("compare-region");
    expect(canonicalFeatureTab("compareRegionViewer", cds)).toBe("compare-region");

    const trna = featureViewRecordSchema.parse({ ...cds, feature_type: "tRNA" });
    const unnamed = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      feature_type: "CDS",
    });
    for (const record of [trna, unnamed]) {
      expect(featureCompareRegionPeg(record)).toBeNull();
      expect(canonicalFeatureTab("compare-region", record)).toBe("overview");
    }
  });
});

describe("Feature list URL schema", () => {
  // Legacy FeatureList: Dnak returns 2,122,831 rows with the PATRIC default, 3,005,987 without (alpha, 2026-10-05).
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
    // `filter=CDS` is an independent scope, so the annotation facet still counts the values the PATRIC default hides.
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

  it("sends a picked Public value to the rows and download query", () => {
    const state = parseFeatureListState({ keyword: "Dnak", public: "false" });
    expect(featureStructuralRql(state)).toBe(
      "and(eq(annotation,PATRIC),eq(public,false))",
    );

    const proteins = parseFeatureListState({
      keyword: "Dnak",
      filter: "protein",
      public: ["true", "false"],
    });
    expect(featureStructuralRql(proteins)).toBe(
      `and(or(eq(public,true),eq(public,false)),${proteinFeatureRql})`,
    );
  });

  it("never sends a Public value the Data API would reject", () => {
    const state = parseFeatureListState({ keyword: "Dnak", public: "yes" });
    expect(featureStructuralRql(state)).toBe("eq(annotation,PATRIC)");
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
    // Alpha's FeatureList lists 5,425 PATRIC features for this genome, not all 10,940.
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
    // The parser accepts a space after `(`; the default must still give way.
    const state = parseFeatureListState({
      rql: "and(eq(genome_id,83332.12),eq( annotation,RefSeq))",
    });
    expect(state.rql).toBe("and(eq(genome_id,83332.12),eq(annotation,RefSeq))");
    expect(state.filters).toEqual({});
  });

  it("does not add the default beside an RQL that picks an annotation", () => {
    const state = parseFeatureListState({
      rql: "and(eq(sequence_id,NC_000962),eq(annotation,PATRIC),eq(feature_type,CDS))",
    });
    expect(state.filters).toEqual({});
    expect(featureStructuralRql(state)).toBeUndefined();
  });

  it("narrows an RQL that picks an annotation with the user's annotation pick", () => {
    // Like the Taxonomy "Features" action's rql, which ends in eq(annotation,PATRIC).
    const rql = "and(eq(genome_id,83332.12),eq(annotation,PATRIC))";
    for (const annotation of ["PATRIC", "RefSeq"]) {
      const state = parseFeatureListState({ rql, annotation });
      expect(state.rql).toBe(rql);
      expect(state.filters).toEqual({ annotation: [annotation] });
      expect(featureStructuralRql(state)).toBe(`eq(annotation,${annotation})`);
    }
  });

  it("leaves the embedded schema without the default", () => {
    expect(parseFeatureCollectionState({}).filters).toEqual({});
    expect(
      parseFeatureCollectionState({ rql: "eq(genome_id,83332.12)" }).filters,
    ).toEqual({});
    expect(featureCollectionOptions.defaultFilters).toBeUndefined();
  });
});

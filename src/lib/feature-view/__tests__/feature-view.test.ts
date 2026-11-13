import {
  buildFeatureTabs,
  canonicalFeatureTab,
  compareRegionAvailability,
  compareRegionNoBrcIdReason,
  compareRegionPendingReason,
  currentCompareRegionAvailability,
  featureCollectionOptions,
  featureCollectionProfile,
  featureGenomeBrowserTarget,
  featureListCollectionOptions,
  featureListOptionsFor,
  featureStructuralRql,
  featureViewRecordSchema,
  isFeatureId,
  isPatricFeatureId,
  parseFeatureCollectionState,
  parseFeatureListState,
  type CompareRegionAvailability,
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
  it("opens the Compare Region Viewer for any feature with a BRC ID of its own", () => {
    const cds = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      feature_type: "CDS",
      patric_id: "fig|1.1.peg.1",
    });
    expect(compareRegionAvailability(cds).peg).toBe("fig|1.1.peg.1");
    expect(canonicalFeatureTab("compare-region", cds)).toBe("compare-region");
    expect(canonicalFeatureTab("compareRegionViewer", cds)).toBe("compare-region");

    // Beyond legacy, which refused a non-CDS: the service answers every fig| id.
    const trna = featureViewRecordSchema.parse({
      ...cds,
      feature_type: "tRNA",
      patric_id: "fig|1.1.rna.3",
    });
    expect(compareRegionAvailability(trna).peg).toBe("fig|1.1.rna.3");
    expect(canonicalFeatureTab("compare-region", trna)).toBe("compare-region");

    const unnamed = featureViewRecordSchema.parse({
      feature_id: "PATRIC.1",
      feature_type: "CDS",
    });
    expect(compareRegionAvailability(unnamed).peg).toBeNull();
    expect(canonicalFeatureTab("compare-region", unnamed)).toBe("overview");
  });

  it("opens the tab on a counterpart's BRC ID and explains a closed tab", () => {
    const refseq = featureViewRecordSchema.parse({
      feature_id: "RefSeq.1",
      annotation: "RefSeq",
      feature_type: "CDS",
    });
    const compareTab = (compare: CompareRegionAvailability) =>
      buildFeatureTabs(refseq, compare).find((tab) => tab.key === "compare-region");

    const open: CompareRegionAvailability = { peg: "fig|1.1.peg.9" };
    expect(compareTab(open)?.enabled).toBe(true);
    expect(compareTab(open)?.disabledReason).toBeUndefined();
    expect(canonicalFeatureTab("compare-region", refseq, open)).toBe("compare-region");

    const closed = compareRegionAvailability(refseq);
    expect(compareTab(closed)?.enabled).toBe(false);
    expect(compareTab(closed)?.disabledReason).toBe(compareRegionNoBrcIdReason);
    expect(canonicalFeatureTab("compare-region", refseq, closed)).toBe("overview");

    // A failed lookup reaches the tab as its own message, not the generic "no BRC ID" one.
    const lookupFailed: CompareRegionAvailability = {
      peg: null,
      reason: "Could not look up this feature's BRC ID: HTTP 503",
    };
    expect(compareTab(lookupFailed)?.enabled).toBe(false);
    expect(compareTab(lookupFailed)?.disabledReason).toBe(
      "Could not look up this feature's BRC ID: HTTP 503",
    );
  });
  it("keeps the tab off while the lookup streams, leaving every other tab as asked", () => {
    const refseq = featureViewRecordSchema.parse({
      feature_id: "RefSeq.1",
      annotation: "RefSeq",
      feature_type: "CDS",
    });
    const pending = currentCompareRegionAvailability(
      new Promise(() => undefined),
    );
    const compareTab = buildFeatureTabs(refseq, pending).find(
      (tab) => tab.key === "compare-region",
    );
    expect(compareTab?.enabled).toBe(false);
    expect(compareTab?.disabledReason).toBe(compareRegionPendingReason);
    expect(canonicalFeatureTab(undefined, refseq, pending)).toBe("overview");
    expect(canonicalFeatureTab("domains", refseq, pending)).toBe("domains");
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

  it("lets an RQL that picks an annotation replace the default", () => {
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

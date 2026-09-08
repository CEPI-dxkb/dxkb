import {
  biosetCollectionProfile,
  biosetStructuralRql,
  biosetViewRecordSchema,
  experimentBiosetCollectionRql,
  experimentBiosetRql,
  experimentCollectionProfile,
  experimentCollectionScopeRql,
  experimentSorts,
  experimentStructuralRql,
  experimentViewRecordSchema,
  genomeExperimentRql,
  isExperimentId,
  parseExperimentCollectionState,
  parseExperimentCollectionTab,
  parseExperimentTab,
} from "@/lib/experiment-view";

describe("Experiment view", () => {
  it("validates positive digit strings without coercion", () => {
    const maxLengthId = "1".repeat(1_000);

    expect(isExperimentId("00042")).toBe(true);
    expect(isExperimentId("2000000")).toBe(true);
    expect(isExperimentId(maxLengthId)).toBe(true);
    expect(isExperimentId(`${maxLengthId}1`)).toBe(false);
    expect(isExperimentId("0")).toBe(false);
    expect(isExperimentId("1.5")).toBe(false);
    expect(isExperimentId("-1")).toBe(false);
    expect(
      experimentViewRecordSchema.safeParse({ exp_id: maxLengthId }).success,
    ).toBe(true);
    expect(
      biosetViewRecordSchema.safeParse({ bioset_id: "b1", exp_id: maxLengthId })
        .success,
    ).toBe(true);
    expect(
      experimentViewRecordSchema.safeParse({ exp_id: `${maxLengthId}1` })
        .success,
    ).toBe(false);
    expect(
      biosetViewRecordSchema.safeParse({
        bioset_id: "b1",
        exp_id: `${maxLengthId}1`,
      }).success,
    ).toBe(false);
  });

  it("excludes multi-valued fields from sorts and retains scalar sorts", () => {
    const multiValuedFields = [
      "experimenters",
      "organism",
      "taxon_id",
      "strain",
      "treatment_type",
      "treatment_name",
      "treatment_amount",
      "treatment_duration",
    ];

    for (const field of multiValuedFields) {
      expect(experimentSorts).not.toContain(`${field}:asc`);
      expect(experimentSorts).not.toContain(`${field}:desc`);
    }
    expect(experimentSorts).toContain("exp_id:asc");
    expect(experimentSorts).toContain("exp_name:desc");
  });

  it("parses collection state and builds multi-value filters", () => {
    const state = parseExperimentCollectionState({
      keyword: "expression",
      taxon_id: "561",
      exp_type: ["RNA", "Proteomics"],
      page: "2",
      sort: "exp_id:desc",
    });
    expect(state).toMatchObject({
      keyword: "expression",
      page: 2,
      sort: "exp_id:desc",
    });
    expect(experimentStructuralRql(state)).toBe(
      "and(eq(taxon_lineage_ids,561),or(eq(exp_type,RNA),eq(exp_type,Proteomics)))",
    );
  });

  it("builds Bioset facet predicates for collection requests", () => {
    const state = {
      filters: {
        bioset_type: ["Differential Expression", "Pathway Analysis"],
        organism: ["Escherichia coli"],
      },
      page: 1,
      sort: "bioset_id:asc",
    };

    expect(biosetCollectionProfile.buildStructuralRql?.(state)).toBe(
      biosetStructuralRql(state),
    );
    expect(biosetStructuralRql(state)).toBe(
      'and(or(eq(bioset_type,"Differential%20Expression"),eq(bioset_type,"Pathway%20Analysis")),eq(organism,"Escherichia%20coli"))',
    );
  });

  it("builds exact child and Genome scopes", () => {
    expect(experimentBiosetRql("00042")).toBe("eq(exp_id,00042)");
    expect(experimentBiosetCollectionRql(["00042", "51"])).toBe(
      "in(exp_id,(00042,51))",
    );
    expect(genomeExperimentRql("83332.12")).toBe("eq(genome_id,83332.12)");
  });

  it("preserves Experiment search scope for the collection Biosets tab", () => {
    const state = parseExperimentCollectionState({
      keyword: "influenza",
      taxon_id: "11320",
      refine: "RNA",
    });
    expect(experimentCollectionScopeRql(state)).toBe(
      "and(eq(taxon_lineage_ids,11320),keyword(RNA))",
    );
    expect(parseExperimentCollectionTab("biosets")).toBe("biosets");
    expect(parseExperimentCollectionTab("missing")).toBe("experiments");
  });

  it("defines member links and canonical tabs", () => {
    expect(experimentCollectionProfile.rowHref?.({ exp_id: "00042" })).toBe(
      "/experiment/00042",
    );
    expect(parseExperimentTab("biosets")).toBe("biosets");
    expect(parseExperimentTab("missing")).toBe("overview");
  });
});

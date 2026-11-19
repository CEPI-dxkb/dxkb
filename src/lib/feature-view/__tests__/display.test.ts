import {
  cleanFeatureProduct,
  featureDisplayName,
  featureFastaTypes,
  featureHeaderParts,
} from "../display";

const featureId = "PATRIC.644340.17.JAEUGC010000001.CDS.12314.12580.rev";

describe("featureDisplayName", () => {
  it("prefers the BRC ID", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: "fig|644340.17.peg.16",
        refseq_locus_tag: "BME_RS00080",
      }),
    ).toBe("fig|644340.17.peg.16");
  });

  it("falls back through the RefSeq locus tag and protein ID", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        refseq_locus_tag: "BME_RS00080",
        protein_id: "WP_002964185.1",
      }),
    ).toBe("BME_RS00080");
    expect(
      featureDisplayName({ feature_id: featureId, protein_id: "WP_1.1" }),
    ).toBe("WP_1.1");
  });

  it("uses the internal key only when nothing public is present", () => {
    expect(featureDisplayName({ feature_id: featureId })).toBe(featureId);
  });

  it("skips blank identifiers", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: "",
        refseq_locus_tag: "BME_RS00080",
      }),
    ).toBe("BME_RS00080");
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: " ",
        refseq_locus_tag: "",
        protein_id: "",
      }),
    ).toBe(featureId);
  });
});

describe("featureFastaTypes", () => {
  it("offers DNA and protein for a coding feature", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: 267, aa_length: 88 }),
    ).toEqual(["dna", "protein"]);
  });

  it("offers DNA only for an untranslated feature", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: "1490" }),
    ).toEqual(["dna"]);
  });

  it("accepts a sequence hash when the length is missing", () => {
    expect(
      featureFastaTypes({
        feature_id: featureId,
        na_sequence_md5: "fada28201fd9184dcb70d15b9d3d346e",
        aa_sequence_md5: "e5a5527dc616466361772e464d2494e3",
      }),
    ).toEqual(["dna", "protein"]);
  });

  it("offers nothing for a record with no sequence", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: 0, aa_length: "" }),
    ).toEqual([]);
  });
});

describe("featureHeaderParts", () => {
  it("lists BV-BRC's identifiers in its order", () => {
    expect(
      featureHeaderParts({
        feature_id: featureId,
        patric_id: "fig|511145.12.peg.1",
        refseq_locus_tag: "b0002",
        gene: "thrA",
        product: "Aspartokinase",
      }),
    ).toEqual({
      name: "fig|511145.12.peg.1",
      details: ["b0002", "thrA", "Aspartokinase"],
    });
  });

  it("does not repeat a locus tag that stands in for the BRC ID", () => {
    expect(
      featureHeaderParts({
        feature_id: featureId,
        refseq_locus_tag: "BME_RS00080",
        gene: " ",
        product: "hypothetical protein",
      }),
    ).toEqual({ name: "BME_RS00080", details: ["hypothetical protein"] });
  });

  it("drops the Data API's 'undefined <feature_type>' product placeholder", () => {
    const parts = featureHeaderParts({
      feature_id: featureId,
      patric_id: "fig|2697049.10377022.gap.2",
      refseq_locus_tag: "X_RS00010",
      product: "undefined gap",
      feature_type: "gap",
    });
    expect(parts).toEqual({
      name: "fig|2697049.10377022.gap.2",
      details: ["X_RS00010"],
    });
    expect(parts.details.join(" ")).not.toContain("undefined");
  });
});

describe("cleanFeatureProduct", () => {
  it("keeps a real product, trimmed", () => {
    expect(cleanFeatureProduct("  nucleocapsid phosphoprotein ", "CDS")).toBe(
      "nucleocapsid phosphoprotein",
    );
  });

  it("drops the Data API's 'undefined <feature_type>' placeholder", () => {
    expect(cleanFeatureProduct("undefined gap", "gap")).toBe("");
    expect(cleanFeatureProduct("undefined 5'UTR", "5'UTR")).toBe("");
    expect(cleanFeatureProduct("undefined assembly_gap", "assembly_gap")).toBe(
      "",
    );
  });

  it("drops the typo spelling and ignores case and spacing", () => {
    expect(cleanFeatureProduct("undefind gap", "gap")).toBe("");
    expect(cleanFeatureProduct("  Undefined   GAP ", "gap")).toBe("");
  });

  it("drops a bare 'undefined'", () => {
    expect(cleanFeatureProduct("undefined", "gap")).toBe("");
    expect(cleanFeatureProduct("undefined")).toBe("");
  });

  it("keeps a real product that only starts with 'Undefined'", () => {
    expect(cleanFeatureProduct("Undefined protein", "CDS")).toBe(
      "Undefined protein",
    );
    expect(cleanFeatureProduct("undefinedX gap", "gap")).toBe(
      "undefinedX gap",
    );
    expect(cleanFeatureProduct("undefined hypothetical protein")).toBe(
      "undefined hypothetical protein",
    );
  });

  it("keeps a product whose 'undefined' runs into punctuation", () => {
    expect(cleanFeatureProduct("undefined-like")).toBe("undefined-like");
    expect(cleanFeatureProduct("undefined(gap)")).toBe("undefined(gap)");
  });

  it("drops 'undefined <INSDC feature key>' when the caller has no feature type", () => {
    expect(cleanFeatureProduct("undefined gap")).toBe("");
    expect(cleanFeatureProduct("undefind 5'UTR", undefined)).toBe("");
    expect(cleanFeatureProduct("undefined repeat_region", "")).toBe("");
  });

  it("drops the placeholder whose suffix is an INSDC key other than the row's feature_type", () => {
    // Solr types these rows misc_RNA, but the pipeline wrote the GenBank key.
    expect(cleanFeatureProduct("undefined mRNA", "misc_RNA")).toBe("");
    expect(cleanFeatureProduct("undefined ncRNA", "misc_RNA")).toBe("");
    expect(cleanFeatureProduct("undefined NonStdRes")).toBe("");
    expect(cleanFeatureProduct("undefind tmRNA", "misc_RNA")).toBe("");
  });

  it("drops the placeholder whose suffix is the row's own feature_type even if it is not an INSDC key", () => {
    expect(cleanFeatureProduct("undefined customKey", "customKey")).toBe("");
  });

  it("keeps a real product that starts with 'Undefined' and is not an INSDC key", () => {
    expect(cleanFeatureProduct("Undefined function")).toBe("Undefined function");
    expect(cleanFeatureProduct("Undefined function", "CDS")).toBe(
      "Undefined function",
    );
    expect(cleanFeatureProduct("undefined customKey")).toBe(
      "undefined customKey",
    );
    expect(cleanFeatureProduct("Undefined Glycoside hydrolase")).toBe(
      "Undefined Glycoside hydrolase",
    );
  });

  it("returns an empty string for a missing, blank or non-string product", () => {
    expect(cleanFeatureProduct(undefined, "gap")).toBe("");
    expect(cleanFeatureProduct(null, "gap")).toBe("");
    expect(cleanFeatureProduct("   ", "gap")).toBe("");
    expect(cleanFeatureProduct(42, "gap")).toBe("");
  });
});

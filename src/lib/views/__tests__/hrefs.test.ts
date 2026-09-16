import {
  epitopeHref,
  epitopeIdFromRow,
  biosetResultsHref,
  experimentHref,
  experimentIdFromRow,
  featureHref,
  featureIdFromRow,
  featureListHref,
  genomeHref,
  genomeIdFromRow,
  genomeListHref,
  featuresHrefFromIds,
  genomesHrefFromIds,
  proteinStructureHref,
  serologyHref,
  serologyIdFromRow,
  surveillanceHref,
  surveillanceIdFromRow,
  taxonomyHref,
} from "../hrefs";
import { rqlEq } from "../rql";

describe("taxonomyHref", () => {
  it("builds a taxonomy route from a numeric id", () => {
    expect(taxonomyHref(561)).toBe("/taxonomy/561");
  });
  it("accepts a string id and rejects a non-positive id", () => {
    expect(taxonomyHref("2697049")).toBe("/taxonomy/2697049");
    expect(() => taxonomyHref("0")).toThrow("Invalid Taxon ID");
  });
});

describe("Epitope hrefs", () => {
  it("builds an encoded member route and extracts the row ID", () => {
    expect(epitopeHref("15/780")).toBe("/epitope/15%2F780");
    expect(epitopeIdFromRow({ epitope_id: 15780 })).toBe("15780");
    expect(epitopeIdFromRow(null)).toBeNull();
  });
});

describe("Experiment hrefs", () => {
  it("preserves digit strings and builds the bioset results link", () => {
    expect(experimentIdFromRow({ exp_id: "00042" })).toBe("00042");
    expect(experimentIdFromRow(null)).toBeNull();
    expect(experimentHref("00042")).toBe("/experiment/00042");
    expect(biosetResultsHref(["00042", "51", "00042"])).toBe(
      "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,51))",
    );
  });
});

describe("Protein Structure hrefs", () => {
  it("builds an accession member link", () => {
    expect(proteinStructureHref("AF-P12345-F1")).toBe(
      "/protein-structure?accession=AF-P12345-F1",
    );
  });
});

describe("Surveillance hrefs", () => {
  it("uses the public sample identifier and encodes the optional discriminator", () => {
    expect(
      surveillanceIdFromRow({ id: "backend-1", sample_identifier: "sample/1" }),
    ).toBe("sample/1");
    expect(surveillanceIdFromRow({ id: "backend-only" })).toBeNull();
    expect(surveillanceHref("sample/1", "RAT/antigen")).toBe(
      "/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen",
    );
  });
});

describe("Serology hrefs", () => {
  it("preserves digit-only IDs and encodes scalar test types", () => {
    expect(
      serologyIdFromRow({ id: "backend-1", sample_identifier: "000123" }),
    ).toBe("000123");
    expect(serologyIdFromRow({ id: "backend-only" })).toBeNull();
    expect(serologyHref("sample/1", "ELISA/IgG test")).toBe(
      "/serology/sample%2F1?test_type=ELISA%2FIgG%20test",
    );
  });
});

describe("Interaction hrefs", () => {
  it("builds a canonical Feature list from pooled interactor IDs", () => {
    expect(
      featuresHrefFromIds([
        "PATRIC.224914.16.NZ_GG703778.CDS.1084382.1084843.fwd",
        "PATRIC.224914.16.NZ_GG703779.CDS.873651.874052.fwd",
        "PATRIC.224914.16.NZ_GG703778.CDS.1084382.1084843.fwd",
      ]),
    ).toBe(
      "/feature?rql=in(feature_id%2C(PATRIC.224914.16.NZ_GG703778.CDS.1084382.1084843.fwd%2CPATRIC.224914.16.NZ_GG703779.CDS.873651.874052.fwd))",
    );
    expect(featuresHrefFromIds([])).toBeNull();
  });
});

describe("Feature hrefs", () => {
  it("encodes member IDs and prefers the canonical row field", () => {
    expect(featureHref("fig|83332.12/peg 1")).toBe(
      "/feature/fig%7C83332.12%2Fpeg%201",
    );
    expect(
      featureIdFromRow({ feature_id: "canonical", patric_id: "alternate" }),
    ).toBe("canonical");
    expect(featureIdFromRow({ patric_id: "alternate" })).toBe("alternate");
    expect(featureIdFromRow(null)).toBeNull();
  });

  it("builds a canonical URL with encoded explicit RQL", () => {
    expect(
      featureListHref({
        rql: "and(eq(genome_id,83332.12),eq(feature_type,CDS))",
      }),
    ).toBe(
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CCDS))",
    );
  });

  it("builds bare, keyword, and protein-filtered list routes", () => {
    expect(featureListHref()).toBe("/feature");
    expect(featureListHref({ keyword: "DNA kinase" })).toBe(
      "/feature?keyword=DNA%20kinase",
    );
    expect(featureListHref({ keyword: "kinase", filter: "protein" })).toBe(
      "/feature?keyword=kinase&filter=protein",
    );
  });
});

describe("genomeHref", () => {
  it("builds an encoded canonical Genome route", () => {
    expect(genomeHref("83332.12")).toBe("/genome/83332.12");
    expect(genomeHref("id/with spaces")).toBe("/genome/id%2Fwith%20spaces");
  });

  it("extracts only string or numeric Genome IDs from rows", () => {
    expect(genomeIdFromRow({ genome_id: "83332.12" })).toBe("83332.12");
    expect(genomeIdFromRow({ genome_id: 42 })).toBe("42");
    expect(genomeIdFromRow({ genome_id: { invalid: true } })).toBeNull();
    expect(genomeIdFromRow(null)).toBeNull();
  });
});

describe("genomesHrefFromIds", () => {
  it("builds a canonical list filtered to unique Genome IDs", () => {
    expect(genomesHrefFromIds(["11320.1", "11320.2", "11320.1"])).toBe(
      "/genome?rql=in(genome_id%2C(11320.1%2C11320.2))",
    );
  });

  it("builds a canonical list from IDs used by the Strain view", () => {
    expect(genomesHrefFromIds(["641501.3", "id,with spaces", "641501.3"])).toBe(
      "/genome?rql=in(genome_id%2C(641501.3%2Cid%252Cwith%20spaces))",
    );
  });

  it("returns null when there are no Genome IDs", () => {
    expect(genomesHrefFromIds([])).toBeNull();
  });

  it("escapes RQL-special characters in Genome IDs", () => {
    const href = genomesHrefFromIds(["id,1", "id(2)"]);
    expect(
      new URL(href ?? "", "http://localhost").searchParams.get("rql"),
    ).toBe("in(genome_id,(id%2C1,id%282%29))");
  });

  it("accepts the Data API's maximum in(...) value count", () => {
    const ids = Array.from({ length: 500 }, (_value, index) => `1.${String(index)}`);
    expect(genomesHrefFromIds(ids)).toContain("in(genome_id%2C(1.0%2C");
  });

  it("returns null above the Data API's in(...) value limit", () => {
    const ids = Array.from({ length: 501 }, (_value, index) => `1.${String(index)}`);
    expect(genomesHrefFromIds(ids)).toBeNull();
    expect(featuresHrefFromIds(ids)).toBeNull();
  });

  it("counts unique IDs against the limit, not raw values", () => {
    const ids = Array.from({ length: 501 }, (_value, index) =>
      index === 500 ? "1.0" : `1.${String(index)}`,
    );
    expect(genomesHrefFromIds(ids)).not.toBeNull();
  });
});

describe("genomeListHref", () => {
  it("returns the bare list route when no rql is given", () => {
    expect(genomeListHref()).toBe("/genome");
    expect(genomeListHref({})).toBe("/genome");
  });
  it("adds and URL-encodes a friendly keyword", () => {
    expect(genomeListHref({ keyword: "E. coli & phage" })).toBe(
      "/genome?keyword=E.%20coli%20%26%20phage",
    );
  });
  it("prefers explicit rql when keyword is also provided", () => {
    expect(
      genomeListHref({ keyword: "ignored", rql: "eq(genus,Escherichia)" }),
    ).toBe("/genome?rql=eq(genus%2CEscherichia)");
  });
  it("URL-encodes the rql query value once (comma → %2C, parens preserved)", () => {
    expect(genomeListHref({ rql: "eq(genus,Escherichia)" })).toBe(
      "/genome?rql=eq(genus%2CEscherichia)",
    );
  });
  it("round-trips a built rqlEq clause back to the unescaped RQL", () => {
    const href = genomeListHref({ rql: rqlEq("genus", "Escherichia") });
    const rql = new URL(href, "http://localhost").searchParams.get("rql");
    expect(rql).toBe("eq(genus,Escherichia)");
  });
});

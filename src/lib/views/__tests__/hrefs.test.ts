import {
  domainsAndMotifsListHref,
  epitopeHref,
  epitopeIdFromRow,
  epitopeListHref,
  biosetResultsHref,
  experimentHref,
  experimentIdFromRow,
  experimentListHref,
  featureHref,
  featureIdFromRow,
  featureListHref,
  genomeHref,
  genomeIdFromRow,
  genomeListHref,
  genomesHrefFromRow,
  proteinStructureHref,
  proteinStructureListHref,
  proteinStructurePathHref,
  serologyHref,
  serologyIdFromRow,
  serologyListHref,
  strainListHref,
  surveillanceHref,
  surveillanceIdFromRow,
  surveillanceListHref,
  taxonomyHref,
} from "../hrefs";
import { rqlEq } from "../rql";

describe("taxonomyHref", () => {
  it("builds a taxonomy route from a numeric id", () => {
    expect(taxonomyHref(561)).toBe("/taxonomy/561");
  });
  it("accepts a string id", () => {
    expect(taxonomyHref("2697049")).toBe("/taxonomy/2697049");
  });
});

describe("Epitope hrefs", () => {
  it("builds encoded member and collection routes", () => {
    expect(epitopeHref("15/780")).toBe("/epitope/15%2F780");
    expect(epitopeIdFromRow({ epitope_id: 15780 })).toBe("15780");
    expect(epitopeIdFromRow(null)).toBeNull();
    expect(epitopeListHref()).toBe("/epitope");
    expect(epitopeListHref({ keyword: "linear peptide", taxonId: 11520 })).toBe(
      "/epitope?keyword=linear%20peptide&taxon_id=11520",
    );
    expect(
      epitopeListHref({ keyword: "ignored", rql: "eq(epitope_type,B-cell)" }),
    ).toBe("/epitope?rql=eq(epitope_type%2CB-cell)");
  });
});

describe("Experiment hrefs", () => {
  it("preserves digit strings and builds collection routes", () => {
    expect(experimentIdFromRow({ exp_id: "00042" })).toBe("00042");
    expect(experimentIdFromRow(null)).toBeNull();
    expect(experimentHref("00042")).toBe("/experiment/00042");
    expect(biosetResultsHref(["00042", "51", "00042"])).toBe(
      "https://www.bv-brc.org/view/BiosetResult/?in(exp_id,(00042,51))",
    );
    expect(experimentListHref({ keyword: "RNA sequencing", taxonId: 561 })).toBe(
      "/experiment?keyword=RNA%20sequencing&taxon_id=561",
    );
    expect(experimentListHref({ keyword: "ignored", rql: "eq(exp_type,Transcript Quantification)" })).toBe(
      "/experiment?rql=eq(exp_type%2CTranscript%20Quantification)",
    );
  });
});

describe("Protein Structure hrefs", () => {
  it("builds accession and workspace member links", () => {
    expect(proteinStructureHref("AF-P12345-F1")).toBe(
      "/protein-structure?accession=AF-P12345-F1",
    );
    expect(proteinStructurePathHref("/user name/home/model.pdb")).toBe(
      "/protein-structure?path=%2Fuser%20name%2Fhome%2Fmodel.pdb",
    );
  });

  it("builds collection links with paging, sorting, and RQL precedence", () => {
    expect(proteinStructureListHref()).toBe("/protein-structure");
    expect(
      proteinStructureListHref({
        keyword: "spike protein",
        taxonId: 2697049,
        genomeId: "123.4",
        page: 2,
        sort: "resolution:desc",
      }),
    ).toBe(
      "/protein-structure?keyword=spike%20protein&taxon_id=2697049&genome_id=123.4&page=2&sort=resolution%3Adesc",
    );
    expect(
      proteinStructureListHref({
        keyword: "ignored",
        taxonId: "ignored",
        genomeId: "ignored",
        rql: "eq(method,Predicted)",
        page: 3,
      }),
    ).toBe("/protein-structure?rql=eq(method%2CPredicted)&page=3");
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

  it("builds collection links with repeated friendly facets and RQL precedence", () => {
    expect(surveillanceListHref()).toBe("/surveillance");
    expect(
      surveillanceListHref({
        keyword: "avian flu",
        pathogenTestType: ["PCR", "RAT/antigen"],
      }),
    ).toBe(
      "/surveillance?keyword=avian%20flu&pathogen_test_type=PCR&pathogen_test_type=RAT%2Fantigen",
    );
    expect(
      surveillanceListHref({
        keyword: "ignored",
        rql: "eq(collection_country,US)",
      }),
    ).toBe("/surveillance?rql=eq(collection_country%2CUS)");
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

  it("builds collection links with repeated facets and RQL precedence", () => {
    expect(
      serologyListHref({
        keyword: "antibody",
        testType: ["ELISA", "Western blot"],
      }),
    ).toBe(
      "/serology?keyword=antibody&test_type=ELISA&test_type=Western%20blot",
    );
    expect(
      serologyListHref({
        keyword: "ignored",
        rql: "eq(collection_country,US)",
      }),
    ).toBe("/serology?rql=eq(collection_country%2CUS)");
  });
});

describe("Domains and Motifs hrefs", () => {
  it("builds list-only links with friendly scopes and RQL precedence", () => {
    expect(domainsAndMotifsListHref()).toBe("/domains-and-motifs");
    expect(
      domainsAndMotifsListHref({
        keyword: "DNA kinase",
        genomeId: "83332.12",
        featureId: "fig|83332.12.peg.1",
      }),
    ).toBe(
      "/domains-and-motifs?keyword=DNA%20kinase&genome_id=83332.12&feature_id=fig%7C83332.12.peg.1",
    );
    expect(
      domainsAndMotifsListHref({
        keyword: "ignored",
        genomeId: "ignored",
        rql: "eq(source,InterPro)",
      }),
    ).toBe("/domains-and-motifs?rql=eq(source%2CInterPro)");
  });
});

describe("Strain hrefs", () => {
  it("builds list-only collection links with phrase and taxon filters", () => {
    expect(strainListHref()).toBe("/strain");
    expect(
      strainListHref({
        keyword: "avian flu",
        taxonId: 11520,
        strain: ["A/B strain", "H1N1"],
      }),
    ).toBe(
      "/strain?keyword=avian%20flu&taxon_id=11520&strain=A%2FB%20strain&strain=H1N1",
    );
    expect(
      strainListHref({
        keyword: "ignored",
        rql: "eq(status,Complete)",
        taxonId: 11520,
        strain: "ignored",
      }),
    ).toBe("/strain?rql=eq(status%2CComplete)");
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

describe("genomesHrefFromRow", () => {
  it("builds a canonical list filtered to unique associated Genome IDs", () => {
    expect(
      genomesHrefFromRow({ genome_ids: ["11320.1", "11320.2", "11320.1"] }),
    ).toBe("/genome?rql=in(genome_id%2C(11320.1%2C11320.2))");
  });

  it("returns null when the row has no associated Genome IDs", () => {
    expect(genomesHrefFromRow({ genome_ids: [] })).toBeNull();
    expect(genomesHrefFromRow({})).toBeNull();
    expect(genomesHrefFromRow(null)).toBeNull();
  });

  it("escapes RQL-special characters in Genome IDs", () => {
    const href = genomesHrefFromRow({ genome_ids: ["id,1", "id(2)"] });
    expect(
      new URL(href ?? "", "http://localhost").searchParams.get("rql"),
    ).toBe("in(genome_id,(id%2C1,id%282%29))");
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

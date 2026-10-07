import { keywordClauses, parseRql } from "@/lib/data-api";
import { encodeQueryComponent } from "@/lib/url";
import { legacySearchFromParams, mapLegacyViewPath } from "../legacy-redirect";
import { rqlAnd } from "../rql";

describe("mapLegacyViewPath", () => {
  it("maps a singular legacy path", () => {
    expect(mapLegacyViewPath("/view/Genome/59201.7581", "")).toEqual({
      pathname: "/genome/59201.7581",
      search: "",
    });
  });
  it("maps a list legacy path with raw RQL into ?rql=", () => {
    expect(mapLegacyViewPath("/view/GenomeList/", "eq(taxon_id,1763)")).toEqual(
      {
        pathname: "/genome",
        search: "rql=eq(taxon_id,1763)",
      },
    );
  });
  it("maps TaxonList to the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=eq(lineage_ids,1763)",
    });
  });
  it("renames the TaxonList lineage field in field position only", () => {
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "and(in(taxon_lineage_ids,(1763,562)),eq(description,%22taxon_lineage_ids%22))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search:
        "rql=and(in(lineage_ids,(1763,562)),eq(description,%2522taxon_lineage_ids%2522))",
    });
  });
  it("leaves the lineage field alone in value position", () => {
    // A bare token is a value here, not a field, so renaming it would change the query.
    expect(
      mapLegacyViewPath("/view/TaxonList/", "keyword(taxon_lineage_ids)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=keyword(taxon_lineage_ids)",
    });
    expect(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_name,taxon_lineage_ids)"),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=eq(taxon_name,taxon_lineage_ids)",
    });
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "in(taxon_name,(taxon_lineage_ids,foo))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search: "rql=in(taxon_name,(taxon_lineage_ids,foo))",
    });
  });
  it("renames the lineage field nested inside logical expressions", () => {
    expect(
      mapLegacyViewPath(
        "/view/TaxonList/",
        "and(or(eq(taxon_lineage_ids,1763),ne(taxon_lineage_ids,562)),sort(+taxon_lineage_ids))",
      ),
    ).toEqual({
      pathname: "/taxonomy",
      search:
        "rql=and(or(eq(lineage_ids,1763),ne(lineage_ids,562)),sort(%2Blineage_ids))",
    });
  });
  it("leaves the lineage field alone outside the taxonomy segment", () => {
    expect(
      mapLegacyViewPath("/view/GenomeList/", "eq(taxon_lineage_ids,1763)"),
    ).toEqual({
      pathname: "/genome",
      search: "rql=eq(taxon_lineage_ids,1763)",
    });
  });
  it("preserves a named query param (surveillance)", () => {
    expect(
      mapLegacyViewPath(
        "/view/Surveillance/ISDN123456",
        "pathogen_test_type=Influenza%20A",
      ),
    ).toEqual({
      pathname: "/surveillance/ISDN123456",
      search: "pathogen_test_type=Influenza+A",
    });
  });
  it("preserves a named query param for a Serology member", () => {
    expect(
      mapLegacyViewPath(
        "/view/Serology/000123",
        "test_type=ELISA%2FIgG%20test",
      ),
    ).toEqual({
      pathname: "/serology/000123",
      search: "test_type=ELISA/IgG+test",
    });
  });

  it("maps the list-only Strain route", () => {
    expect(mapLegacyViewPath("/view/StrainList/", "strain=H1N1")).toEqual({
      pathname: "/strain",
      search: "strain=H1N1",
    });
  });

  it("maps Epitope member and list routes", () => {
    expect(mapLegacyViewPath("/view/Epitope/15780", "")).toEqual({
      pathname: "/epitope/15780",
      search: "",
    });
    expect(
      mapLegacyViewPath("/view/EpitopeList/", "eq(taxon_id,11520)"),
    ).toEqual({
      pathname: "/epitope",
      search: "rql=eq(taxon_id,11520)",
    });
  });

  it("maps both Domains and Motifs list aliases", () => {
    expect(
      mapLegacyViewPath(
        "/view/DomainsAndMotifsList/",
        "eq(genome_id,83332.12)",
      ),
    ).toEqual({
      pathname: "/domains-and-motifs",
      search: "rql=eq(genome_id,83332.12)",
    });
    expect(
      mapLegacyViewPath(
        "/view/ProteinFeaturesList/",
        "feature_id=fig%7C83332.12.peg.1",
      ),
    ).toEqual({
      pathname: "/domains-and-motifs",
      search: "feature_id=fig%7C83332.12.peg.1",
    });
  });

  it("maps Protein aliases to Feature member and list routes", () => {
    expect(mapLegacyViewPath("/view/Protein/fig%7C83332.12.peg.1", "")).toEqual(
      {
        pathname: "/feature/fig%7C83332.12.peg.1",
        search: "",
      },
    );
    expect(mapLegacyViewPath("/view/ProteinList/", "keyword=kinase")).toEqual({
      pathname: "/feature",
      search: "keyword=kinase&filter=protein",
    });
  });

  it("returns null for an unknown legacy view name", () => {
    expect(mapLegacyViewPath("/view/Nonsense/1", "")).toBeNull();
  });
  it("returns null for a non-/view path", () => {
    expect(mapLegacyViewPath("/genome/123", "")).toBeNull();
  });
  it("maps a list legacy path with named params (not RQL) using URLSearchParams encoding", () => {
    expect(
      mapLegacyViewPath(
        "/view/GenomeList/",
        "keyword=mycobacterium tuberculosis",
      ),
    ).toEqual({
      pathname: "/genome",
      search: "keyword=mycobacterium+tuberculosis",
    });
  });
  // Legacy's own links carry a lone keyword(x) (`/view/FeatureList/?keyword(Dnak)`),
  // and its search box sends a multi-word search as one clause per word
  // (`and(keyword(coli),keyword(Salmonella))`). As `?keyword=` the Feature list
  // applies its PATRIC default and the Genome list's related tabs run the
  // keyword themselves, as legacy does; as `?rql=` neither would. `?keyword=`
  // sends one exact clause per word or quoted phrase, so it keeps a link's
  // meaning wherever the keyword reads back as written: unquoted words (the
  // Data API matches keyword(coli Salmonella) like the per-word clauses: 1,933
  // genomes on alpha), a quoted single word, whose quotes it keeps
  // (keyword("Rv0001") is 1 PATRIC feature, keyword(Rv0001) 341,190), and a
  // quoted phrase, which it sends whole (keyword("DNA polymerase"): 16,285,620
  // PATRIC features, the words apart 22,504,678).
  it.each([
    ["/view/FeatureList/", "keyword(Dnak)", "/feature", "keyword=Dnak"],
    ["/view/GenomeList/", "keyword(Dnak)", "/genome", "keyword=Dnak"],
    [
      "/view/ProteinList/",
      "keyword(Dnak)",
      "/feature",
      "keyword=Dnak&filter=protein",
    ],
    [
      "/view/GenomeList/",
      "keyword(Dnak)&sort(-date_inserted)",
      "/genome",
      "keyword=Dnak",
    ],
    ["/view/FeatureList/", "keyword(a%2Cb)", "/feature", "keyword=a,b"],
    [
      "/view/GenomeList/",
      "keyword(coli Salmonella)",
      "/genome",
      "keyword=coli+Salmonella",
    ],
    ["/view/FeatureList/", 'keyword("Rv0001")', "/feature", "keyword=%22Rv0001%22"],
    [
      "/view/GenomeList/",
      "and(keyword(coli),keyword(Salmonella))",
      "/genome",
      "keyword=coli+Salmonella",
    ],
    [
      "/view/FeatureList/",
      "and(keyword(DNA),keyword(polymerase))&sort(-score)",
      "/feature",
      "keyword=DNA+polymerase",
    ],
    [
      "/view/FeatureList/",
      'and(keyword("Rv0001"),keyword(coli))',
      "/feature",
      "keyword=%22Rv0001%22+coli",
    ],
    [
      "/view/FeatureList/",
      'keyword("DNA polymerase")',
      "/feature",
      "keyword=%22DNA+polymerase%22",
    ],
    [
      "/view/GenomeList/",
      "keyword(%22DNA%20polymerase%22)&sort(-score)",
      "/genome",
      "keyword=%22DNA+polymerase%22",
    ],
    [
      "/view/GenomeList/",
      'and(keyword(coli),keyword("DNA polymerase"))',
      "/genome",
      "keyword=coli+%22DNA+polymerase%22",
    ],
    [
      "/view/FeatureList/",
      'keyword("Rv0001" coli)',
      "/feature",
      "keyword=%22Rv0001%22+coli",
    ],
    // `?keyword=` reads Solr syntax as spaces (`keywordQuery`). Solr splits a
    // word at these anyway (keyword(coli-K12) and the parts ANDed are both
    // 1,666 genomes), and keyword(GO:0003677) is an HTTP 400 as written.
    ["/view/GenomeList/", "keyword(coli-K12)", "/genome", "keyword=coli-K12"],
    ["/view/GenomeList/", "keyword(H1N1/2009)", "/genome", "keyword=H1N1/2009"],
    ["/view/FeatureList/", "keyword(GO:0003677)", "/feature", "keyword=GO:0003677"],
    // ?keyword= reads Solr's operators as Solr does inside one clause
    // (keyword(coli -Salmonella) and keyword(coli NOT Salmonella) are both
    // 132,341 genomes, keyword(coli OR Salmonella) and keyword(coli ||
    // Salmonella) 195,658), and sends them as RQL, so the OR cannot leak out.
    ["/view/GenomeList/", "keyword(coli -Salmonella)", "/genome", "keyword=coli+-Salmonella"],
    [
      "/view/GenomeList/",
      'keyword(coli -"DNA polymerase")',
      "/genome",
      "keyword=coli+-%22DNA+polymerase%22",
    ],
    ["/view/GenomeList/", "keyword(coli NOT Salmonella)", "/genome", "keyword=coli+NOT+Salmonella"],
    ["/view/GenomeList/", "and(keyword(coli),keyword(-Salmonella))", "/genome", "keyword=coli+-Salmonella"],
    ["/view/GenomeList/", "keyword(coli OR Salmonella)", "/genome", "keyword=coli+OR+Salmonella"],
    ["/view/GenomeList/", "keyword(coli || Salmonella)", "/genome", "keyword=coli+OR+Salmonella"],
    [
      "/view/FeatureList/",
      "keyword(%22DNA%20polymerase%22%20OR%20helicase)",
      "/feature",
      "keyword=%22DNA+polymerase%22+OR+helicase",
    ],
  ])("maps %s?%s to a keyword search", (path, rawSearch, pathname, search) => {
    expect(mapLegacyViewPath(path, rawSearch)).toEqual({ pathname, search });
  });

  // Anything `?keyword=` would not send as written stays RQL: a keyword beside
  // another clause, keyword(*), a list without the keyword redirect, and a
  // quote `?keyword=` would rebalance (an open quote, which Solr rejects, or a
  // quote inside a word).
  it.each([
    ["/view/FeatureList/", "and(keyword(Dnak),eq(feature_type,CDS))", "/feature", "rql=and(keyword(Dnak),eq(feature_type,CDS))"],
    ["/view/GenomeList/", "keyword(*)", "/genome", "rql=keyword(*)"],
    ["/view/GenomeList/", "and(keyword(coli),keyword(*))", "/genome", "rql=and(keyword(coli),keyword(*))"],
    ["/view/TaxonList/", "keyword(Mycobacterium)", "/taxonomy", "rql=keyword(Mycobacterium)"],
    [
      "/view/TaxonList/",
      "and(keyword(coli),keyword(Salmonella))",
      "/taxonomy",
      "rql=and(keyword(coli),keyword(Salmonella))",
    ],
    [
      "/view/FeatureList/",
      'keyword("DNA polymerase)',
      "/feature",
      "rql=keyword(%22DNA+polymerase)",
    ],
    [
      "/view/GenomeList/",
      'keyword(RNA"pol")',
      "/genome",
      "rql=keyword(RNA%22pol%22)",
    ],
    // Legacy's search box puts a NOT inside an OR only by mistake, and the Data
    // API reads or(not(keyword(coli)),keyword(Salmonella)) as Lucene does
    // (Salmonella AND NOT coli, 61,384 genomes) where ?keyword= offers the NOT
    // as an OR (16,901,125). A search of only NOTs, and(not(...),not(...)), is
    // 0 rows as written and anchored on ?keyword=.
    [
      "/view/GenomeList/",
      "or(not(keyword(coli)),keyword(Salmonella))",
      "/genome",
      "rql=or(not(keyword(coli)),keyword(Salmonella))",
    ],
    [
      "/view/GenomeList/",
      "and(not(keyword(coli)),not(keyword(Salmonella)))",
      "/genome",
      "rql=and(not(keyword(coli)),not(keyword(Salmonella)))",
    ],
    // A lone keyword with a NOT inside its OR is sent as Solr reads it, coli
    // AND NOT Salmonella (132,341 genomes), as RQL, so the OR cannot leak.
    [
      "/view/GenomeList/",
      "keyword(coli OR NOT Salmonella)",
      "/genome",
      "rql=or(keyword(coli),not(keyword(Salmonella)))",
    ],
    [
      "/view/GenomeList/",
      "keyword(coli OR -Salmonella)",
      "/genome",
      "rql=or(keyword(coli),not(keyword(Salmonella)))",
    ],
    // A value's dangling operator must not join the next value.
    [
      "/view/GenomeList/",
      "and(keyword(coli OR),keyword(Salmonella))",
      "/genome",
      "rql=and(keyword(coli+OR),keyword(Salmonella))",
    ],
    // A multi-word OR option would read differently as text: `E coli OR x` is
    // E AND (coli OR x).
    [
      "/view/GenomeList/",
      "or(keyword(E%20coli),keyword(Salmonella))",
      "/genome",
      "rql=or(keyword(E%2520coli),keyword(Salmonella))",
    ],
    [
      "/view/FeatureList/",
      "keyword(Dnak)&keyword=GroEL",
      "/feature",
      "rql=keyword(Dnak)&keyword=GroEL",
    ],
    // Solr syntax that works as written and that `?keyword=` would read as a
    // space: a boost (keyword(coli^2) is coli's 134,274 genomes, coli and 2
    // ANDed 130,072), a range (keyword(<coli): 129) and a regular expression
    // (keyword(/col/): 3,382).
    ["/view/GenomeList/", "keyword(coli^2)", "/genome", "rql=keyword(coli%5E2)"],
    ["/view/GenomeList/", "keyword(<coli)", "/genome", "rql=keyword(%3Ccoli)"],
    ["/view/GenomeList/", "keyword(/col/)", "/genome", "rql=keyword(/col/)"],
  ])("keeps %s?%s as RQL", (path, rawSearch, pathname, search) => {
    expect(mapLegacyViewPath(path, rawSearch)).toEqual({ pathname, search });
  });

  // Alpha's search box sends or(...) and not(...) of keywords (searchToQuery);
  // as ?keyword= the Genome list's related tabs run them on their own
  // collections, as alpha's do, where ?rql= would join through genome().
  it.each([
    ["or(keyword(coli),keyword(Salmonella))", "coli OR Salmonella"],
    ["and(keyword(kinase),not(keyword(hypothetical)))", "kinase NOT hypothetical"],
    [
      "and(keyword(E),or(keyword(coli),keyword(Salmonella)))&sort(-score)",
      "E coli OR Salmonella",
    ],
    [
      'and(keyword(%22DNA%20polymerase%22),or(keyword(coli),keyword(%22Rv0001%22)),not(keyword(hypothetical)))',
      '"DNA polymerase" coli OR "Rv0001" NOT hypothetical',
    ],
  ])("maps alpha's search-box query %s to the keyword it searches", (rawSearch, keyword) => {
    expect(mapLegacyViewPath("/view/GenomeList/", rawSearch)).toEqual({
      pathname: "/genome",
      search: `keyword=${encodeQueryComponent(keyword)}`,
    });
    // The keyword reads back as the link's own query.
    const query = rawSearch.replace(/&sort\([^()]*\)$/, "");
    expect(decodeURIComponent(rqlAnd(...keywordClauses(keyword, "exact")))).toBe(
      decodeURIComponent(query),
    );
  });

  it("splits mixed RQL + named param so filter= is not swallowed into rql=", () => {
    expect(
      mapLegacyViewPath(
        "/view/FeatureList/",
        'eq(genome_id,83332.12)&filter="CDS"',
      ),
    ).toEqual({
      pathname: "/feature",
      search: "rql=eq(genome_id,83332.12)&filter=%22CDS%22",
    });
  });
});

describe("legacySearchFromParams", () => {
  // Each input is the form-encoded query Next.js hands the proxy after parsing
  // and re-serializing the raw legacy URL (see the helper's doc comment).
  it.each([
    ["an RQL fragment", "eq%28genome_status%2CComplete%29=", "eq(genome_status,Complete)"],
    ["an unnormalized RQL fragment", "eq(taxon_id,1763)", "eq(taxon_id,1763)"],
    [
      "RQL beside named params",
      "eq%28taxon_id%2C1763%29=&keyword=a+b&filter=%22CDS%22",
      "eq(taxon_id,1763)&keyword=a+b&filter=%22CDS%22",
    ],
    ["RQL containing =", "eq%28a%2Cb=c%29", "eq(a,b=c)"],
    [
      "a literal % and & in an RQL value",
      "eq%28name%2C100%25%26more%29=",
      "eq(name,100%25%26more)",
    ],
    ["separate RQL fragments", "eq%28a%2C1%29=&eq%28b%2C2%29=", "eq(a,1)&eq(b,2)"],
    [
      "an encoded comma in a comparison value",
      "eq%28genome_name%2Cfoo%2Cbar%29=",
      "eq(genome_name,foo%2Cbar)",
    ],
    [
      "an encoded comma in a nested comparison value",
      "and%28eq%28a%2C1%29%2Cne%28b%2Cx%2Cy%2Cz%29%29=",
      "and(eq(a,1),ne(b,x%2Cy%2Cz))",
    ],
    ["an encoded comma in a keyword", "keyword%28a%2Cb%29=", "keyword(a%2Cb)"],
    [
      "a quoted comma",
      "eq%28genome_name%2C%22foo%2Cbar%22%29=",
      'eq(genome_name,"foo,bar")',
    ],
    ["in-list commas", "in%28genome_id%2C%28a%2Cb%29%29=", "in(genome_id,(a,b))"],
    ["no query", "", ""],
  ])("rebuilds %s", (_name, normalized, raw) => {
    expect(legacySearchFromParams(new URLSearchParams(normalized))).toBe(raw);
  });

  it("keeps an encoded comma inside the destination's comparison value", () => {
    // Next hands the proxy ?eq(genome_name,foo%2Cbar) as this normalized form.
    const normalized = new URLSearchParams("eq%28genome_name%2Cfoo%2Cbar%29=");
    const mapped = mapLegacyViewPath(
      "/view/GenomeList/",
      legacySearchFromParams(normalized),
    );
    const rql = new URLSearchParams(mapped?.search).get("rql") ?? "";
    expect(parseRql("genome", rql)).toEqual({
      operator: "eq",
      field: "genome_name",
      value: "foo,bar",
    });
  });

  it("gives the mapper the same RQL as the raw query string", () => {
    const normalized = new URLSearchParams(
      "eq%28taxon_lineage_ids%2C1763%29=&keyword=kinase",
    );
    expect(
      mapLegacyViewPath("/view/TaxonList/", legacySearchFromParams(normalized)),
    ).toEqual(
      mapLegacyViewPath("/view/TaxonList/", "eq(taxon_lineage_ids,1763)&keyword=kinase"),
    );
  });
});

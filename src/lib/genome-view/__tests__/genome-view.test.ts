import { describe, expect, it } from "vitest";
import {
  genomeDomainsRql,
  genomeFeatureRql,
  genomeProteinRql,
  taxonomyInteractionsRql,
  taxonomySequenceRql,
} from "@/lib/views/child-resources";
import {
  buildGenomeTabs,
  canonicalGenomeTab,
  genomeBaseRql,
  genomeCollectionOptions,
  genomeCollectionProfile,
  genomeInteractionsRql,
  genomeOverviewScope,
  genomeRelatedScope,
  genomeSequenceRql,
  genomeStructuralRql,
  genomeTaxonScope,
  genomeViewRecordSchema,
  isGenomeId,
  parseGenomeCollectionState,
  recentGenomeRql,
} from "@/lib/genome-view";
import {
  parseCollectionState,
  toSearchParamsRecord,
  updateCollectionSearchParams,
  type CollectionState,
} from "@/lib/views/collection-state";

describe("Genome view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseGenomeCollectionState({}).sort).toBe("unsorted");
    expect(parseGenomeCollectionState({ sort: "genome_name:asc" }).sort).toBe(
      "genome_name:asc",
    );
  });

  it("uses the legacy recent, non-deprecated scope for an unfiltered global list", () => {
    expect(recentGenomeRql).toBe(
      "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))",
    );
    expect(
      genomeBaseRql({ keyword: "", filters: {}, page: 1, sort: "unsorted" }),
    ).toBe(recentGenomeRql);
  });

  it("does not restrict an explicit RQL query to recent genomes", () => {
    expect(
      genomeBaseRql({
        keyword: "",
        filters: {},
        page: 1,
        sort: "unsorted",
        rql: "in(genome_id,(11320.1,11320.2))",
      }),
    ).toBeUndefined();
  });

  it("does not restrict a keyword search to recent genomes", () => {
    expect(
      genomeBaseRql({
        keyword: "Dnak",
        filters: {},
        page: 1,
        sort: "unsorted",
      }),
    ).toBeUndefined();
  });

  it("accepts dotted numeric IDs only", () => {
    expect(isGenomeId("83332.12")).toBe(true);
    expect(isGenomeId("83332")).toBe(false);
    expect(isGenomeId("83332.x")).toBe(false);
  });

  it("validates the fields used by the overview", () => {
    expect(
      genomeViewRecordSchema.parse({
        genome_id: "83332.12",
        genome_length: "100",
      }),
    ).toMatchObject({ genome_id: "83332.12" });
    expect(() =>
      genomeViewRecordSchema.parse({ genome_id: "invalid" }),
    ).toThrow();
  });

  it("parses all canonical collection state and maps taxon scope", () => {
    const state = parseGenomeCollectionState({
      keyword: "coli",
      taxon_id: "561",
      page: "3",
      sort: "genome_length:desc",
    });
    expect(state).toEqual({
      keyword: "coli",
      refine: undefined,
      rql: undefined,
      filters: { taxon_id: ["561"] },
      page: 3,
      sort: "genome_length:desc",
    });
    expect(genomeStructuralRql(state)).toBe("eq(taxon_lineage_ids,561)");
  });

  it("combines facet filters without a hidden status predicate", () => {
    const state = parseGenomeCollectionState({
      genome_status: "Complete",
      isolation_country: "USA",
    });
    expect(genomeStructuralRql(state)).toBe(
      "and(eq(genome_status,Complete),eq(isolation_country,USA))",
    );
  });

  it("gives explicit rql precedence without adding Deprecated filters", () => {
    const state = parseGenomeCollectionState({
      taxon_id: "561",
      rql: "eq(genome_status,Complete)",
    });
    expect(state.filters).toEqual({});
    expect(state.rql).toBe("eq(genome_status,Complete)");
    expect(genomeStructuralRql(state)).toBeUndefined();
  });

  it("scopes the My Genomes link to private genomes without the recent default", () => {
    const state = parseGenomeCollectionState({ public: "false" });
    expect(state.rql).toBeUndefined();
    expect(state.filters).toEqual({ public: ["false"] });
    expect(genomeStructuralRql(state)).toBe("eq(public,false)");
    expect(genomeBaseRql(state)).toBeUndefined();
  });

  it("keeps the private-genome scope when a facet is selected", () => {
    const next = updateCollectionSearchParams(
      { public: "false" },
      { filters: { genome_status: ["Complete"] } },
      genomeCollectionOptions,
    );
    const state = parseGenomeCollectionState(toSearchParamsRecord(next));
    expect(genomeStructuralRql(state)).toBe(
      "and(eq(genome_status,Complete),eq(public,false))",
    );
    expect(genomeBaseRql(state)).toBeUndefined();
  });

  it("drops a non-boolean visibility filter", () => {
    const state = parseGenomeCollectionState({ public: "maybe" });
    expect(state.filters).toEqual({});
    expect(genomeBaseRql(state)).toBe(recentGenomeRql);
  });

  it("drops a non-boolean visibility filter on the taxon Genomes tab", () => {
    // That tab reads the URL through the generic parser, not
    // parseGenomeCollectionState, and the gateway rejects eq(public,maybe).
    const state = parseCollectionState(
      { public: "maybe", genome_status: "Complete" },
      genomeCollectionOptions,
    );
    expect(genomeStructuralRql(state)).toBe("eq(genome_status,Complete)");
  });

  it("canonicalizes invalid pages and sorts while rejecting transport RQL", () => {
    expect(parseGenomeCollectionState({ page: "0" }).page).toBe(1);
    expect(parseGenomeCollectionState({ sort: "unknown:asc" }).sort).toBe(
      "unsorted",
    );
    expect(() =>
      parseGenomeCollectionState({ rql: "sort(+genome_id)" }),
    ).toThrow("Transport operator");
  });

  it("builds exact child predicates", () => {
    expect(genomeSequenceRql("83332.12")).toBe("eq(genome_id,83332.12)");
    expect(genomeDomainsRql("83332.12")).toBe("eq(genome_id,83332.12)");
    // Symmetric on the interaction endpoints — a PPI row can file the scoped
    // genome on either side. Endpoint coverage lives in
    // src/lib/views/__tests__/interaction-predicates.test.ts.
    expect(genomeInteractionsRql("83332.12")).toBe(
      "and(or(eq(genome_id_a,83332.12),eq(genome_id_b,83332.12)),eq(evidence,experimental))",
    );
    expect(genomeFeatureRql("83332.12", "CDS")).toBe(
      "and(eq(genome_id,83332.12),eq(feature_type,CDS))",
    );
    expect(genomeProteinRql("83332.12")).toBe(
      "and(eq(genome_id,83332.12),or(eq(feature_type,CDS),eq(feature_type,mat_peptide)),eq(annotation,PATRIC))",
    );
    expect(taxonomySequenceRql("eq(taxon_lineage_ids,561)")).toBe(
      "and(eq(genome_id,*),genome(and(eq(taxon_lineage_ids,561),ne(genome_status,Deprecated))))",
    );
    expect(taxonomyInteractionsRql("eq(taxon_lineage_ids,561)")).toBe(
      "and(eq(genome_id_a,*),genome(to(genome_id_a),and(eq(taxon_lineage_ids,561),ne(genome_status,Deprecated))),eq(evidence,experimental))",
    );
  });

  it("uses canonical member links and legacy default columns", () => {
    expect(genomeCollectionProfile.rowHref?.({ genome_id: "83332.12" })).toBe(
      "/genome/83332.12",
    );
    expect(genomeCollectionProfile.rowLinkField).toBe("genome_name");
    expect(genomeCollectionProfile.basePredicate).toBe("eq(genome_id,*)");
    expect(
      genomeCollectionProfile.columns
        .filter((column) => column.visible)
        .map((column) => column.id),
    ).toEqual([
      "genome_name",
      "strain",
      "genbank_accessions",
      "genome_length",
      "cds",
      "collection_year",
      "isolation_country",
      "host_common_name",
    ]);
  });

  it("capability-gates interactions and all future tabs", () => {
    const bacterial = genomeViewRecordSchema.parse({
      genome_id: "1.1",
      superkingdom: "Bacteria",
    });
    const viral = genomeViewRecordSchema.parse({
      genome_id: "2.2",
      superkingdom: "Viruses",
    });
    expect(
      buildGenomeTabs(bacterial).find((tab) => tab.key === "interactions")
        ?.enabled,
    ).not.toBe(false);
    expect(
      buildGenomeTabs(viral).find((tab) => tab.key === "interactions")?.enabled,
    ).toBe(false);
    expect(canonicalGenomeTab("features", bacterial)).toBe("features");
    expect(canonicalGenomeTab("proteins", bacterial)).toBe("proteins");
    expect(canonicalGenomeTab("domains", bacterial)).toBe("domains");
    expect(canonicalGenomeTab("domains", viral)).toBe("domains");
    expect(canonicalGenomeTab("sequences", bacterial)).toBe("sequences");
    expect(canonicalGenomeTab("nonsense", bacterial)).toBe("overview");
  });
});

describe("genomeBaseRql with a refinement", () => {
  it("does not restrict a refined list to recent genomes", () => {
    // As for a keyword (Fix 2): the Genomes tab and the related tabs, which run
    // the refinement on their own collections, then cover the same records.
    expect(
      genomeBaseRql({ filters: {}, page: 1, sort: "unsorted", refine: "coli" }),
    ).toBeUndefined();
    expect(
      genomeBaseRql({ filters: {}, page: 1, sort: "unsorted", refine: "  " }),
    ).toBe(recentGenomeRql);
  });

  it("keeps the recent default for a blank keyword, which searches nothing", () => {
    // The Data API trims the keyword away, so `?keyword=%20` is the bare list.
    expect(
      genomeBaseRql({ filters: {}, page: 1, sort: "unsorted", keyword: " " }),
    ).toBe(recentGenomeRql);
  });
});

describe("genomeRelatedScope", () => {
  const bare: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

  it("leaves the related tabs unscoped for the bare list", () => {
    expect(genomeRelatedScope(bare)).toBeUndefined();
    expect(genomeRelatedScope({ ...bare, keyword: " ", refine: "" })).toBeUndefined();
  });

  it("passes keyword and refinement clauses straight to the related collection", () => {
    expect(genomeRelatedScope({ ...bare, keyword: " Dnak " })).toEqual({
      rql: "keyword(Dnak)",
      join: false,
    });
    expect(
      genomeRelatedScope({ ...bare, keyword: "Dnak", refine: "coli" }),
    ).toEqual({ rql: "and(keyword(Dnak),keyword(coli))", join: false });
    expect(genomeRelatedScope({ ...bare, refine: "coli" })).toEqual({
      rql: "keyword(coli)",
      join: false,
    });
  });

  it("keeps Solr's OR and NOT on the tabs' own collections", () => {
    // Alpha's search box sends `coli or Salmonella` as
    // or(keyword(coli),keyword(Salmonella)) and hands it to every tab's
    // collection; as ?rql= the tabs would join through genome() instead.
    expect(
      genomeRelatedScope({ ...bare, keyword: "coli OR Salmonella" }),
    ).toEqual({ rql: "or(keyword(coli),keyword(Salmonella))", join: false });
    expect(
      genomeRelatedScope({ ...bare, keyword: "kinase NOT hypothetical" }),
    ).toEqual({
      rql: "and(keyword(kinase),not(keyword(hypothetical)))",
      join: false,
    });
  });

  it("splits a multi-word keyword as the Genomes tab's own search does", () => {
    // The Genomes tab sends ?keyword=coli Salmonella as
    // and(keyword(coli),keyword(Salmonella)) (1,933 genomes, legacy's count);
    // one keyword(coli Salmonella) clause is the phrase, 29 genomes.
    expect(genomeRelatedScope({ ...bare, keyword: "coli Salmonella" })).toEqual({
      rql: "and(keyword(coli),keyword(Salmonella))",
      join: false,
    });
    // The refinement too, as ResourceCollection's `rqlKeyword` reads it.
    expect(
      genomeRelatedScope({
        ...bare,
        keyword: "coli Salmonella",
        refine: " DNA polymerase ",
      }),
    ).toEqual({
      rql: "and(keyword(coli),keyword(Salmonella),keyword(DNA),keyword(polymerase))",
      join: false,
    });
    expect(
      genomeRelatedScope({
        ...bare,
        filters: { taxon_id: ["1763"] },
        keyword: "coli Salmonella",
      }),
    ).toEqual({
      rql: "and(eq(taxon_lineage_ids,1763),keyword(coli),keyword(Salmonella))",
      join: true,
    });
  });

  it("keeps a quoted keyword's quotes on the related collections", () => {
    // Legacy's search quotes id-like words (keyword(%22Rv0001%22)); the
    // Genomes tab's ?keyword= sends them that way too.
    expect(genomeRelatedScope({ ...bare, keyword: '"Rv0001"' })).toEqual({
      rql: "keyword(%22Rv0001%22)",
      join: false,
    });
  });

  it("reads a keyword or refinement without terms as none", () => {
    // `"` alone (a phrase being typed) or empty quotes search for nothing, so
    // the list keeps its recent-genomes default instead of listing every genome.
    const empty = { ...bare, keyword: '""', refine: '"' };
    expect(genomeBaseRql(empty)).toBe(recentGenomeRql);
    expect(genomeRelatedScope(empty)).toBeUndefined();
    // Nor does an operator with nothing to join, or only syntax.
    const syntax = { ...bare, keyword: "OR", refine: "/ -" };
    expect(genomeBaseRql(syntax)).toBe(recentGenomeRql);
    expect(genomeRelatedScope(syntax)).toBeUndefined();
  });

  it("sends a quoted phrase to the related collections whole", () => {
    // Alpha's GenomeList/?keyword(%22DNA%20polymerase%22) Sequences tab reads
    // 16,199 rows with the phrase; split onto its words it would find none.
    expect(
      genomeRelatedScope({ ...bare, keyword: 'coli "DNA polymerase"' }),
    ).toEqual({
      rql: "and(keyword(coli),keyword(%22DNA%20polymerase%22))",
      join: false,
    });
  });

  it("joins to the listed genomes for filters, visibility and explicit RQL", () => {
    expect(
      genomeRelatedScope({ ...bare, filters: { taxon_id: ["1763"] } }),
    ).toEqual({
      rql: `and(${recentGenomeRql},eq(taxon_lineage_ids,1763))`,
      join: true,
    });
    expect(
      genomeRelatedScope({
        ...bare,
        filters: { public: ["false"] },
        keyword: "Dnak",
      }),
    ).toEqual({ rql: "and(eq(public,false),keyword(Dnak))", join: true });
    expect(
      genomeRelatedScope({
        ...bare,
        rql: "eq(genus,Mycobacterium)",
        refine: "coli",
      }),
    ).toEqual({ rql: "and(keyword(coli),eq(genus,Mycobacterium))", join: true });
    expect(
      genomeRelatedScope({
        ...bare,
        filters: { taxon_id: ["1763"] },
        refine: "coli",
      }),
    ).toEqual({
      rql: "and(eq(taxon_lineage_ids,1763),keyword(coli))",
      join: true,
    });
  });
});

describe("genomeTaxonScope", () => {
  const bare: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

  it("leaves the taxon-scoped tabs unscoped for the bare list", () => {
    // The recent-genomes default is the Genomes tab's own, not a scope.
    expect(genomeTaxonScope(bare)).toEqual({ supported: true });
  });

  it("runs keyword, refinement and taxon clauses on the tab's collection", () => {
    expect(genomeTaxonScope({ ...bare, keyword: "pseudomonas" })).toEqual({
      supported: true,
      rql: "keyword(pseudomonas)",
    });
    expect(
      genomeTaxonScope({
        ...bare,
        keyword: "coli OR Salmonella",
        refine: "kinase",
        filters: { taxon_id: ["561", "590"] },
      }),
    ).toEqual({
      supported: true,
      rql: "and(or(eq(taxon_lineage_ids,561),eq(taxon_lineage_ids,590)),or(keyword(coli),keyword(Salmonella)),keyword(kinase))",
    });
  });

  it("keeps an rql that names only the taxon lineage", () => {
    expect(
      genomeTaxonScope({
        ...bare,
        rql: "and(in(taxon_lineage_ids,(3044781,186536)),not(eq(taxon_lineage_ids,10239)))",
      }),
    ).toEqual({
      supported: true,
      rql: "and(in(taxon_lineage_ids,(3044781,186536)),not(eq(taxon_lineage_ids,10239)))",
    });
  });

  it.each<[string, Partial<CollectionState>]>([
    ["a genome status filter", { filters: { genome_status: ["Complete"] } }],
    ["the My Genomes visibility", { filters: { public: ["false"] } }],
    ["a genome ID list", { rql: "in(genome_id,(1.1,1.2))" }],
    [
      "a lineage beside another genome field",
      { rql: "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))" },
    ],
  ])("is unsupported for %s", (_label, scope) => {
    expect(genomeTaxonScope({ ...bare, keyword: "coli", ...scope })).toEqual({
      supported: false,
    });
  });

  it("is unsupported when the combined query is too deep to parse", () => {
    let rql = "eq(taxon_lineage_ids,561)";
    for (let level = 0; level < 12; level++) rql = `not(${rql})`;
    const state = parseGenomeCollectionState({ rql });
    // The rql alone parses, and names only the taxon lineage.
    expect(genomeTaxonScope(state)).toEqual({ supported: true, rql });
    expect(genomeTaxonScope({ ...state, keyword: "coli" })).toEqual({
      supported: false,
    });
  });
});

describe("genomeOverviewScope", () => {
  const bare: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

  it("summarizes the genomes the Genomes tab lists", () => {
    expect(genomeOverviewScope(bare)).toEqual({ fieldRql: recentGenomeRql });
    expect(genomeOverviewScope({ ...bare, keyword: "pseudomonas" })).toEqual({
      keywordRql: "keyword(pseudomonas)",
    });
    expect(
      genomeOverviewScope({ ...bare, filters: { public: ["true"] } }),
    ).toEqual({ fieldRql: "eq(public,true)" });
  });

  it("keeps keyword clauses apart from genome-field clauses", () => {
    expect(
      genomeOverviewScope({
        ...bare,
        keyword: "pseudomonas",
        refine: "coli",
        filters: { genome_status: ["Complete"] },
      }),
    ).toEqual({
      fieldRql: "eq(genome_status,Complete)",
      keywordRql: "and(keyword(pseudomonas),keyword(coli))",
    });
    expect(
      genomeOverviewScope({
        ...bare,
        keyword: "coli",
        rql: "in(genome_id,(1.1,1.2))",
      }),
    ).toEqual({
      fieldRql: "in(genome_id,(1.1,1.2))",
      keywordRql: "keyword(coli)",
    });
  });

  it("keeps the keyword clauses of an explicit rql apart", () => {
    expect(genomeOverviewScope({ ...bare, rql: "keyword(coli)" })).toEqual({
      keywordRql: "keyword(coli)",
    });
    expect(
      genomeOverviewScope({
        ...bare,
        keyword: "pseudomonas",
        rql: "and(and(eq(genome_status,Complete),keyword(coli)),or(keyword(a),not(keyword(b))))",
      }),
    ).toEqual({
      fieldRql: "eq(genome_status,Complete)",
      keywordRql:
        "and(keyword(pseudomonas),keyword(coli),or(keyword(a),not(keyword(b))))",
    });
  });

  it("keeps a clause mixing keywords and genome fields whole", () => {
    // Splitting `or` or `not` would change which genomes match.
    const rql = "or(keyword(coli),eq(genome_status,Complete))";
    expect(genomeOverviewScope({ ...bare, rql })).toEqual({ fieldRql: rql });
    expect(
      genomeOverviewScope({
        ...bare,
        rql: `and(${rql},keyword(salmonella))`,
      }),
    ).toEqual({ fieldRql: rql, keywordRql: "keyword(salmonella)" });
  });

  it("is unavailable for a list that includes private genomes", () => {
    expect(
      genomeOverviewScope({ ...bare, filters: { public: ["false"] } }),
    ).toBeUndefined();
  });

  it.each([
    "eq(public,false)",
    "eq(public,*)",
    "ne(public,true)",
    "in(public,(true,false))",
    "not(eq(public,true))",
    "not(ne(public,*))",
    "and(eq(genome_status,Complete),or(keyword(coli),eq(public,false)))",
    "or(eq(genome_status,Complete),eq(public,false))",
  ])("is unavailable for an rql that selects private genomes: %s", (rql) => {
    expect(genomeOverviewScope({ ...bare, rql })).toBeUndefined();
  });

  it.each([
    "eq(public,true)",
    "ne(public,false)",
    "in(public,(true))",
    "not(eq(public,false))",
    "not(in(public,(true,false)))",
    // A clause that admits private genomes, overruled by the rest.
    "and(eq(public,true),in(public,(true,false)))",
    "and(eq(public,true),or(eq(public,false),eq(genome_status,Complete)))",
    "or(eq(genome_status,Complete),and(eq(public,false),eq(public,true)))",
    // Private genomes reach this one only through genome_status, as they reach
    // a list with no visibility clause at all.
    "or(eq(public,true),eq(genome_status,Complete))",
  ])("stays available for an rql of public genomes: %s", (rql) => {
    expect(genomeOverviewScope({ ...bare, rql })).toEqual({ fieldRql: rql });
  });

  it("keeps an rql whole when validation grew it past the parse limit", () => {
    // Each space serializes as `%20`, so this validates to over 8,000 characters.
    const state = parseGenomeCollectionState({
      rql: `eq(genome_name,${"a b ".repeat(1100).trim()})`,
    });
    expect(state.rql?.length).toBeGreaterThan(8000);
    expect(genomeOverviewScope(state)).toEqual({ fieldRql: state.rql });
  });
});

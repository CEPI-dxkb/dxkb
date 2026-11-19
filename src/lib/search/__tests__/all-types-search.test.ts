import { http, HttpResponse } from "msw";

import {
  allTypesSearchPath,
  allTypesSearchQueryOptions,
  describeRows,
  fetchTypeMatches,
  formatCompact,
  toAllTypesResults,
  typeSearchQuery,
} from "../all-types-search";
import { taxonGenomeCountQueries } from "../all-types-query";
import { allTermSearchTypes } from "@/constants/search-info";
import { DataRepositoryError } from "@/lib/data-api/client";
import { keywordClauses } from "@/lib/data-api/rql";
import { genomeBaseRql, parseGenomeCollectionState } from "@/lib/genome-view";
import { nonDeprecatedGenomeClause } from "@/lib/services/organisms/genome-scope";
import { toSearchParamsRecord } from "@/lib/views/collection-state";
import { rqlAnd } from "@/lib/views/rql";
import { isUpstreamOutage } from "@/lib/api/query-retry";
import {
  parseTaxonomyCollectionState,
  taxonomyCollectionProfile,
  taxonViewHeader,
} from "@/lib/taxonomy-view";
import { ServerDataRepository } from "@/lib/data-api/repository";
import { server } from "@/test-helpers/msw-server";

const searchRoute = `*${allTypesSearchPath}`;

describe("typeSearchQuery", () => {
  it.each([
    [
      "taxonomy",
      "or(keyword(influenza),eq(other_names,%22influenza%22))&gt(genomes,1)&limit(5)&sort(-genomes)",
    ],
    [
      "genome_feature",
      "keyword(influenza)&ne(annotation,brc1)&ne(feature_type,source)&limit(5)&sort(+annotation,-score)",
    ],
    ["epitope", "keyword(influenza)&limit(5)&sort(-score)"],
    ["strain", "keyword(influenza)&limit(5)&sort(-score)"],
  ])("builds the %s query", (id, expected) => {
    expect(typeSearchQuery(id, "influenza", 5)).toBe(expected);
  });

  it.each([
    [
      "SARS-CoV-2",
      "or(and(keyword(SARS),keyword(CoV),keyword(2)),eq(other_names,%22SARS%20CoV%202%22))&gt(genomes,1)&limit(5)&sort(-genomes)",
    ],
    [
      'SARS CoV "2"',
      "or(and(keyword(SARS),keyword(CoV),keyword(%222%22)),eq(other_names,%22SARS%20CoV%202%22))&gt(genomes,1)&limit(5)&sort(-genomes)",
    ],
    [
      "HIV-1",
      "or(and(keyword(HIV),keyword(1)),eq(other_names,%22HIV%201%22))&gt(genomes,1)&limit(5)&sort(-genomes)",
    ],
    [
      'HIV "1"',
      "or(and(keyword(HIV),keyword(%221%22)),eq(other_names,%22HIV%201%22))&gt(genomes,1)&limit(5)&sort(-genomes)",
    ],
  ])(
    "also matches the Taxa card's %s against other names, where abbreviations live",
    (keyword, expected) => {
      expect(typeSearchQuery("taxonomy", keyword, 5)).toBe(expected);
    },
  );

  it.each([
    ["coli -Salmonella", "and(keyword(coli),not(keyword(Salmonella)))"],
    ['"quoted phrase"', "keyword(%22quoted%20phrase%22)"],
    ["a OR b", "or(keyword(a),keyword(b))"],
    ["E*", "keyword(E%2A)"],
  ])(
    "keeps the Taxa card's keyword clause alone for %s",
    (keyword, clause) => {
      expect(typeSearchQuery("taxonomy", keyword, 5)).toBe(
        `${clause}&gt(genomes,1)&limit(5)&sort(-genomes)`,
      );
    },
  );

  it.each(["genome", "genome_feature", "strain", "epitope", "serology"])(
    "leaves the %s query without an other_names branch",
    (id) => {
      const query = typeSearchQuery(id, "SARS-CoV-2", 5);
      expect(query).not.toContain("other_names");
      expect(
        query.startsWith("and(keyword(SARS),keyword(CoV),keyword(2))&"),
      ).toBe(true);
    },
  );

  it("leaves Deprecated genomes out of the Genomes count, as the list it links to does", () => {
    expect(typeSearchQuery("genome", "Coronaviridae", 10)).toBe(
      "keyword(Coronaviridae)&ne(genome_status,Deprecated)&limit(10)&sort(+genome_status,+genome_quality,-score)",
    );
  });

  it("builds the Genomes card's query for SARS-CoV-2: its keywords, no Deprecated genomes, complete good-quality genomes first", () => {
    expect(typeSearchQuery("genome", "SARS-CoV-2", 10)).toBe(
      "and(keyword(SARS),keyword(CoV),keyword(2))&ne(genome_status,Deprecated)&limit(10)&sort(+genome_status,+genome_quality,-score)",
    );
    expect(typeSearchQuery("genome", 'SARS CoV "2"', 10)).toBe(
      "and(keyword(SARS),keyword(CoV),keyword(%222%22))&ne(genome_status,Deprecated)&limit(10)&sort(+genome_status,+genome_quality,-score)",
    );
  });

  it("changes only the Genomes card's sort: the other cards keep theirs", () => {
    const sortOf = (id: string) =>
      /&sort\((.*)\)$/.exec(typeSearchQuery(id, "coli", 10))?.[1];
    expect(sortOf("genome")).toBe("+genome_status,+genome_quality,-score");
    expect(sortOf("genome_feature")).toBe("+annotation,-score");
    expect(sortOf("taxonomy")).toBe("-genomes");
    const others = allTermSearchTypes
      .map((type) => type.id)
      .filter((id) => !["genome", "genome_feature", "taxonomy"].includes(id));
    expect(others).toContain("strain");
    for (const id of others) expect(sortOf(id)).toBe("-score");
  });

  it.each(["Coronaviridae", "coli Salmonella"])(
    "counts the rows of the list the Genomes card links to (%s)",
    (keyword) => {
      const card = toAllTypesResults(undefined, keyword).types.find(
        (type) => type.id === "genome",
      );
      const href = new URL(card?.listHref ?? "", "https://dxkb.test");
      expect(href.pathname).toBe("/genome");
      const listState = parseGenomeCollectionState(
        toSearchParamsRecord(href.searchParams),
      );
      const listBase = genomeBaseRql(listState);
      expect(listBase).toBe(nonDeprecatedGenomeClause);
      const cardClauses = typeSearchQuery("genome", keyword, 10)
        .split("&")
        .filter((part) => !/^(limit|sort)\(/.test(part));
      expect(cardClauses).toEqual([
        rqlAnd(...keywordClauses(listState.keyword ?? "", "exact")),
        listBase,
      ]);
    },
  );

  it.each([
    'SARS CoV "2"',
    'HIV "1"',
    "influenza",
    "kinase NOT hypothetical",
    '"Ebola virus"',
  ])(
    "matches taxa with the predicate the `/taxonomy?keyword=` list it links to sends (%s)",
    async (keyword) => {
      const card = toAllTypesResults(undefined, keyword).types.find(
        (type) => type.id === "taxonomy",
      );
      const href = new URL(card?.listHref ?? "", "https://dxkb.test");
      expect(href.pathname).toBe("/taxonomy");
      const listState = parseTaxonomyCollectionState(
        toSearchParamsRecord(href.searchParams),
      );
      const requested: string[] = [];
      server.use(
        http.get("https://data.test/taxonomy/", ({ request }) => {
          requested.push(new URL(request.url).search);
          return HttpResponse.json({ response: { numFound: 0, docs: [] } });
        }),
      );
      // The list's server read, as `/api/data/taxonomy` runs it.
      await new ServerDataRepository({ baseUrl: "https://data.test" }).collection(
        "taxonomy",
        {
          operation: "collection",
          keyword: listState.keyword,
          keywordMode: taxonomyCollectionProfile.serverKeywordMode,
        },
      );
      const [cardPredicate] = typeSearchQuery("taxonomy", keyword, 10).split(
        "&",
      );
      expect(requested).toHaveLength(1);
      // The URL carries the predicate's own `"`-free text as written.
      const [listPredicate] = requested[0].slice(1).split("&");
      expect(listPredicate).toBe(cardPredicate);
    },
  );
});

describe("taxonGenomeCountQueries", () => {
  it("builds one limit(1) count per taxon with the Taxonomy header's definition", () => {
    expect(taxonGenomeCountQueries(["11118", "694009"])).toEqual({
      "taxonGenomes:11118": {
        dataType: "genome",
        accept: "application/solr+json",
        query:
          "and(eq(taxon_lineage_ids,11118),ne(genome_status,Deprecated))&select(genome_id)&limit(1)",
      },
      "taxonGenomes:694009": {
        dataType: "genome",
        accept: "application/solr+json",
        query:
          "and(eq(taxon_lineage_ids,694009),ne(genome_status,Deprecated))&select(genome_id)&limit(1)",
      },
    });
  });
});

describe("fetchTypeMatches", () => {
  it("asks the same-origin search route, naming only the keyword", async () => {
    let sent: unknown;
    const matches = { genome: { result: { response: { numFound: 3 } } } };
    server.use(
      http.post(searchRoute, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(matches);
      }),
    );

    await expect(fetchTypeMatches("influenza")).resolves.toEqual(matches);
    expect(sent).toEqual({ keyword: "influenza" });
  });

  it("keeps the route's own message and status, so an outage is not retried", async () => {
    const message =
      "The BV-BRC data service did not respond (connection timed out after 10 s).";
    server.use(
      http.post(searchRoute, () =>
        HttpResponse.json(
          { error: message, code: "upstream_timeout" },
          { status: 504 },
        ),
      ),
    );

    const error: unknown = await fetchTypeMatches("influenza").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(DataRepositoryError);
    expect(error).toMatchObject({
      message,
      status: 504,
      code: "upstream_timeout",
    });
    expect(isUpstreamOutage(error)).toBe(true);
  });

  it("reports a failed request without a message by its status", async () => {
    server.use(
      http.post(searchRoute, () => new HttpResponse("oops", { status: 500 })),
    );
    await expect(fetchTypeMatches("influenza")).rejects.toThrow(
      "Search request failed with status 500.",
    );
  });

  it("says the search service could not be reached, keeping the browser's reason", async () => {
    server.use(http.post(searchRoute, () => HttpResponse.error()));

    await expect(fetchTypeMatches("influenza")).rejects.toThrow(
      /^Could not reach the DXKB search service \(.+\)\. Check your connection and try again\.$/,
    );
  });

  it("is not enabled for text with no search terms", () => {
    expect(allTypesSearchQueryOptions('""', "anonymous").enabled).toBe(false);
    expect(allTypesSearchQueryOptions("coli", "anonymous").enabled).toBe(true);
  });
});

describe("describeRows", () => {
  it("describes a Strain by its own species, host and segments, linking its record", () => {
    expect(
      describeRows("strain", [
        {
          id: "s1",
          strain: "A/Ohio/1/2020",
          species: "Influenza A virus",
          host_name: "Human",
          collection_year: 2020,
          segment_count: 8,
          genbank_accessions: ["CY000001", "CY000002"],
        },
      ]),
    ).toEqual([
      {
        key: "s1",
        title: "A/Ohio/1/2020",
        monoTitle: false,
        context: "Influenza A virus · Human",
        facts: [
          { label: "Year", value: "2020" },
          { label: "Segments", value: "8 segments" },
        ],
        id: "CY000001",
        href: "/strain/s1",
      },
    ]);
  });

  it("leaves a Strain without a record ID unlinked", () => {
    const [row] = describeRows("strain", [{ strain: "A/China" }]);
    expect(row).toMatchObject({ key: "strain-0", href: null });
  });

  it("describes a Domain or Motif by its InterPro entry, linking its feature", () => {
    const [row] = describeRows("protein_feature", [
      {
        id: "pf1",
        feature_id: "PATRIC.11320.1.CDS.1.566.fwd",
        patric_id: "fig|11320.1.peg.1",
        interpro_description: "Hemagglutinin",
        interpro_id: "IPR001364",
        product: "HA",
        genome_name: "Influenza A virus",
        source: "PFAM",
        source_id: "PF00509",
        start: 1,
        end: 566,
      },
    ]);
    expect(row).toMatchObject({
      title: "Hemagglutinin",
      context: "HA · Influenza A virus",
      id: "IPR001364",
      href: "/feature/PATRIC.11320.1.CDS.1.566.fwd",
      facts: [
        { label: "Source", value: "PFAM PF00509" },
        { label: "Position", value: "1–566" },
      ],
    });
  });

  it("links a Domain or Motif by its PATRIC ID when it has no feature ID", () => {
    const [row] = describeRows("protein_feature", [
      { id: "pf1", patric_id: "fig|11320.1.peg.1" },
    ]);
    expect(row.href).toBe("/feature/fig%7C11320.1.peg.1");
  });

  it("leaves a Domain or Motif without a feature unlinked", () => {
    const [row] = describeRows("protein_feature", [{ id: "pf1" }]);
    expect(row).toMatchObject({ key: "pf1", href: null });
  });

  it("titles a Feature by its product and gene, linking its record", () => {
    const [row] = describeRows("genome_feature", [
      {
        feature_id: "PATRIC.2697049.1.NC_045512.CDS.28274.29533.fwd",
        patric_id: "fig|2697049.1.peg.10",
        product: "nucleocapsid phosphoprotein",
        gene: "N",
        feature_type: "CDS",
        annotation: "PATRIC",
        genome_name: "SARS-CoV-2",
      },
    ]);
    expect(row).toMatchObject({
      title: "nucleocapsid phosphoprotein | N",
      id: "fig|2697049.1.peg.10",
      href: "/feature/PATRIC.2697049.1.NC_045512.CDS.28274.29533.fwd",
    });
  });

  it("falls back to the feature type when the Data API's product is 'undefined gap'", () => {
    const [row] = describeRows("genome_feature", [
      {
        feature_id: "PATRIC.2697049.10377022.PX491150.gap.4410.4603.fwd",
        patric_id: "fig|2697049.10377022.gap.2",
        product: "undefined gap",
        feature_type: "gap",
        annotation: "PATRIC",
        na_length: 194,
      },
    ]);
    expect(row.title).toBe("gap");
    expect(row.title).not.toContain("undefined");
    expect(row.id).toBe("fig|2697049.10377022.gap.2");
  });

  it("treats the 'undefind' typo placeholder the same way", () => {
    const [row] = describeRows("genome_feature", [
      {
        feature_id: "f1",
        product: "undefind assembly_gap",
        feature_type: "assembly_gap",
      },
    ]);
    expect(row.title).toBe("assembly_gap");
  });

  it("falls back to the feature type when a Feature has no product", () => {
    const [row] = describeRows("genome_feature", [
      { feature_id: "f2", feature_type: "gene", gene: "S" },
    ]);
    expect(row.title).toBe("gene | S");
  });

  it("falls back to the BRC ID when a Feature has neither a usable product nor a type", () => {
    const [row] = describeRows("genome_feature", [
      { feature_id: "f3", patric_id: "fig|1.1.peg.1", product: "undefined" },
    ]);
    expect(row.title).toBe("fig|1.1.peg.1");
  });

  it("shows an Epitope's sequence in mono and links it", () => {
    const [row] = describeRows("epitope", [
      { epitope_id: 12345, epitope_sequence: "GILGFVFTL", host_name: ["Human"] },
    ]);
    expect(row).toMatchObject({
      monoTitle: true,
      title: "GILGFVFTL",
      id: "IEDB 12345",
      href: "/epitope/12345",
      facts: [{ label: "Host", value: "Human" }],
    });
  });

  it.each([
    [["PCR"], "/surveillance/S-1?pathogen_test_type=PCR"],
    ["PCR", "/surveillance/S-1?pathogen_test_type=PCR"],
    [["PCR", "Culture"], "/surveillance/S-1"],
  ])(
    "links a Surveillance sample tested %j to %s",
    (pathogenTestType, href) => {
      const [row] = describeRows("surveillance", [
        {
          id: "row-1",
          sample_identifier: "S-1",
          pathogen_test_type: pathogenTestType,
          host_common_name: "Mallard",
          collection_country: "Canada",
          collection_date: "2021-04-02T00:00:00Z",
        },
      ]);
      expect(row.title).toBe("Mallard · Canada · 2021");
      expect(row.href).toBe(href);
    },
  );

  it("names a Serology sample by its ID and links it with its test type", () => {
    const [row] = describeRows("serology", [
      {
        id: "row-1",
        sample_identifier: "SR-1",
        host_common_name: "Human",
        collection_country: "Australia",
        collection_date: "2024-07",
        test_type: "HI",
        test_result: "Detected",
        serotype: "H1N1",
      },
    ]);
    expect(row).toMatchObject({
      title: "SR-1",
      context: "Human · Australia · 2024",
      href: "/serology/SR-1?test_type=HI",
    });
  });

  it("leaves a row without an ID unlinked, keyed by its place", () => {
    expect(describeRows("genome", [{ genome_name: "Unnamed" }])).toEqual([
      expect.objectContaining({ key: "genome-0", id: "", href: null }),
    ]);
  });

  it("names a row missing its title fields by its ID, or as Untitled", () => {
    expect(
      describeRows("genome", [{ genome_id: "11320.1" }, {}]).map(
        (row) => row.title,
      ),
    ).toEqual(["11320.1", "Untitled"]);
  });
});

describe("toAllTypesResults", () => {
  it("lists every DXKB type, zero-count ones included, and totals them", () => {
    const { types, total, bestMatch } = toAllTypesResults(
      {
        genome: { result: { response: { docs: [], numFound: 12 } } },
        experiment: { result: { response: { docs: [], numFound: 3 } } },
      },
      "influenza",
    );
    expect(types).toHaveLength(10);
    expect(types.find((type) => type.id === "strain")).toMatchObject({
      label: "Strains",
      count: 0,
      listHref: "/strain?keyword=influenza",
      contextLabel: "Species · Host",
    });
    expect(total).toBe(15);
    expect(bestMatch).toBeNull();
  });

  it("counts a type with a partial answer as zero, not as an error", () => {
    const { types, total, bestMatch } = toAllTypesResults(
      {
        genome: {},
        taxonomy: { result: {} },
        strain: { result: { response: { numFound: 2 } } },
      },
      "influenza",
    );
    expect(types.find((type) => type.id === "genome")).toMatchObject({
      count: 0,
      rows: [],
    });
    expect(types.find((type) => type.id === "strain")).toMatchObject({
      count: 2,
      rows: [],
    });
    expect(total).toBe(2);
    expect(bestMatch).toBeNull();
  });

  it("takes the best match from the top taxon", () => {
    const { bestMatch } = toAllTypesResults(
      {
        taxonomy: {
          result: {
            response: {
              numFound: 1,
              docs: [
                {
                  taxon_id: 2697049,
                  taxon_name: "Severe acute respiratory syndrome coronavirus 2",
                  taxon_rank: "no rank",
                  genomes: 9_000_000,
                  lineage_ids: [
                    10239, 2559587, 2732396, 2732408, 2732506, 76804, 2499399,
                    11118, 2501931, 694002, 2509511, 3418604, 2697049,
                  ],
                  lineage_names: [
                    "Viruses",
                    "Riboviria",
                    "Orthornavirae",
                    "Pisuviricota",
                    "Pisoniviricetes",
                    "Nidovirales",
                    "Cornidovirineae",
                    "Coronaviridae",
                    "Orthocoronavirinae",
                    "Betacoronavirus",
                    "Sarbecovirus",
                    "Betacoronavirus pandemicum",
                    "Severe acute respiratory syndrome coronavirus 2",
                  ],
                  lineage_ranks: [
                    "acellular root",
                    "realm",
                    "kingdom",
                    "phylum",
                    "class",
                    "order",
                    "suborder",
                    "family",
                    "subfamily",
                    "genus",
                    "subgenus",
                    "species",
                    "no rank",
                  ],
                },
              ],
            },
          },
        },
        "taxonGenomes:2697049": {
          result: { response: { numFound: 8_900_000, docs: [] } },
        },
      },
      "SARS-CoV-2",
    );
    expect(bestMatch).toEqual({
      name: "Severe acute respiratory syndrome coronavirus 2",
      taxonId: "2697049",
      href: "/taxonomy/2697049",
      genomes: 8_900_000,
      rank: "No rank",
      parents: [
        "Pisuviricota",
        "Pisoniviricetes",
        "Nidovirales",
        "Coronaviridae",
        "Betacoronavirus",
        "Betacoronavirus pandemicum",
      ],
    });
  });

  describe("picks the best match among the returned taxa", () => {
    function taxa(
      keyword: string,
      docs: Record<string, unknown>[],
      counts: Record<string, number> = {},
    ) {
      return toAllTypesResults(
        {
          taxonomy: {
            result: { response: { numFound: docs.length, docs } },
          },
          ...Object.fromEntries(
            Object.entries(counts).map(([taxonId, numFound]) => [
              `taxonGenomes:${taxonId}`,
              { result: { response: { numFound, docs: [] } } },
            ]),
          ),
        },
        keyword,
      ).bestMatch;
    }

    const sarsCov2 = {
      taxon_id: 2697049,
      taxon_name: "Severe acute respiratory syndrome coronavirus 2",
      taxon_rank: "no rank",
      other_names: [
        "2019-nCoV",
        "COVID-19 virus",
        "HCoV-19",
        "SARS-2",
        "SARS2",
        "SARS-CoV-2",
        "SARS-CoV2",
      ],
    };
    const hivGroupM = {
      taxon_id: 11676001,
      taxon_name: "HIV-1 group M",
      taxon_rank: "no rank",
      other_names: ["Human immunodeficiency virus 1 group M"],
    };
    const hiv1 = {
      taxon_id: 11676,
      taxon_name: "Human immunodeficiency virus 1",
      taxon_rank: "species",
      other_names: ["HIV-1", "HIV1"],
    };
    const zaire = {
      taxon_id: 186538,
      taxon_name: "Zaire ebolavirus",
      taxon_rank: "species",
      other_names: ["Ebola virus", "EBOV"],
    };
    const ebola = {
      taxon_id: 1570291,
      taxon_name: "Ebola virus",
      taxon_rank: "no rank",
    };
    const sudan = {
      taxon_id: 186540,
      taxon_name: "Sudan ebolavirus",
      taxon_rank: "species",
    };

    it("takes a taxon whose other names hold the keyword, when it is the only row", () => {
      expect(
        taxa('SARS CoV "2"', [sarsCov2], { "2697049": 8_900_000 }),
      ).toMatchObject({
        name: "Severe acute respiratory syndrome coronavirus 2",
        taxonId: "2697049",
        href: "/taxonomy/2697049",
        genomes: 8_900_000,
        rank: "No rank",
      });
    });

    it("takes the taxon whose other names hold the keyword over a row with more genomes", () => {
      expect(taxa('HIV "1"', [hivGroupM, hiv1])?.name).toBe(
        "Human immunodeficiency virus 1",
      );
    });

    it("counts the chosen taxon's genomes, not the first row's", () => {
      expect(
        taxa('HIV "1"', [hivGroupM, hiv1], {
          "11676001": 4_925,
          "11676": 1_099_453,
        }),
      ).toMatchObject({ taxonId: "11676", genomes: 1_099_453 });
    });

    it("takes the taxon named as the keyword over a taxon with more genomes that has it as an other name", () => {
      expect(taxa("Ebola virus", [zaire, ebola, sudan])).toMatchObject({
        name: "Ebola virus",
        taxonId: "1570291",
      });
    });

    it("prefers an exact name over an other-names hit whatever their order", () => {
      expect(taxa("Ebola virus", [ebola, zaire])?.name).toBe("Ebola virus");
    });

    it("takes the first row when no taxon has the keyword as a name or other name", () => {
      expect(taxa("ebolavirus", [zaire, ebola, sudan])?.name).toBe(
        "Zaire ebolavirus",
      );
    });

    it.each(["SARS-CoV-2", "sars-cov-2", "SARS CoV 2", 'sars cov "2"'])(
      "matches the keyword %s across case, hyphens and spaces",
      (keyword) => {
        expect(taxa(keyword, [hivGroupM, sarsCov2])?.name).toBe(
          "Severe acute respiratory syndrome coronavirus 2",
        );
      },
    );

    it("matches the name across case and hyphens too", () => {
      expect(taxa("hiv 1 GROUP m", [hiv1, hivGroupM])?.name).toBe(
        "HIV-1 group M",
      );
    });

    it("takes the first row for a keyword with operators, negation or wildcards", () => {
      for (const keyword of ["Ebola virus OR Zika", "ebola -Sudan", "Ebola*"])
        expect(taxa(keyword, [zaire, ebola])?.name).toBe("Zaire ebolavirus");
    });

    // `nameKey` drops `*`, `?` and `|`, so these keys would equal the name "Ebola virus"; the Taxa query skips its other-names branch for them too.
    it.each(["Ebola virus*", "Ebola virus?", "Ebola virus|"])(
      "takes the first row for the wildcard or pipe keyword %s, though its words equal a taxon's name",
      (keyword) => {
        expect(taxa(keyword, [zaire, ebola])?.name).toBe("Zaire ebolavirus");
      },
    );

    it("matches a quoted phrase that is a taxon's name", () => {
      expect(taxa('"Ebola virus"', [zaire, ebola])?.name).toBe("Ebola virus");
    });

    it("does not let a keyword with no words match a taxon", () => {
      expect(
        taxa("---", [
          { taxon_id: 2, taxon_name: "Other", other_names: ["--", ""] },
          { taxon_id: 1, taxon_name: "---" },
        ])?.taxonId,
      ).toBe("2");
    });

    it("tolerates other names that are missing, a single string, or mixed with other values", () => {
      const noOtherNames = { taxon_id: 1, taxon_name: "Alpha virus" };
      expect(
        taxa("Beta", [
          noOtherNames,
          { taxon_id: 2, taxon_name: "Beta virus", other_names: "Beta" },
        ])?.taxonId,
      ).toBe("2");
      expect(
        taxa("Beta", [
          noOtherNames,
          { taxon_id: 3, taxon_name: "Gamma", other_names: [null, 7, {}, "Beta"] },
        ])?.taxonId,
      ).toBe("3");
      expect(
        taxa("Beta", [
          noOtherNames,
          { taxon_id: 4, taxon_name: "Delta", other_names: [null, 7, {}] },
          { taxon_id: 5, taxon_name: "Epsilon", other_names: 7 },
        ])?.taxonId,
      ).toBe("1");
    });

    it("tolerates a doc without a name among the candidates", () => {
      expect(
        taxa("Ebola virus", [{ taxon_id: 9 }, ebola])?.taxonId,
      ).toBe("1570291");
    });

    it("has no best match when the chosen doc has no name", () => {
      expect(taxa("Ebola virus", [{ taxon_id: 9 }])).toBeNull();
    });
  });

  it("uses the shared genome count for the best match and the Taxa rows, not the stored field", () => {
    const results = toAllTypesResults(
      {
        taxonomy: {
          result: {
            response: {
              numFound: 1,
              docs: [
                {
                  taxon_id: 11118,
                  taxon_name: "Coronaviridae",
                  taxon_rank: "family",
                  genomes: 9_500_742,
                },
              ],
            },
          },
        },
        "taxonGenomes:11118": {
          result: { response: { numFound: 9_471_991, docs: [] } },
        },
      },
      "Coronaviridae",
    );
    expect(results.bestMatch?.genomes).toBe(9_471_991);
    const taxa = results.types.find((type) => type.id === "taxonomy");
    expect(taxa?.rows[0].facts).toContainEqual({
      label: "Genomes",
      value: "9,471,991 genomes",
    });
  });

  it("shows a count of zero as 0 genomes, not as missing", () => {
    const results = toAllTypesResults(
      {
        taxonomy: {
          result: {
            response: {
              numFound: 1,
              docs: [
                { taxon_id: 11118, taxon_name: "Coronaviridae", genomes: 4 },
              ],
            },
          },
        },
        "taxonGenomes:11118": { result: { response: { numFound: 0, docs: [] } } },
      },
      "Coronaviridae",
    );
    expect(results.bestMatch?.genomes).toBe(0);
    const taxa = results.types.find((type) => type.id === "taxonomy");
    expect(taxa?.rows[0].facts).toContainEqual({
      label: "Genomes",
      value: "0 genomes",
    });
  });

  it("omits the genome figure when the count is missing instead of showing the stored one", () => {
    const results = toAllTypesResults(
      {
        taxonomy: {
          result: {
            response: {
              numFound: 1,
              docs: [
                {
                  taxon_id: 11118,
                  taxon_name: "Coronaviridae",
                  genomes: 9_500_742,
                },
              ],
            },
          },
        },
      },
      "Coronaviridae",
    );
    expect(results.bestMatch?.genomes).toBeNull();
    const taxa = results.types.find((type) => type.id === "taxonomy");
    expect(
      taxa?.rows[0].facts.find((fact) => fact.label === "Genomes"),
    ).toBeUndefined();
  });
});

const coronaviridae = {
  taxon_id: "11118",
  taxon_name: "Coronaviridae",
  taxon_rank: "family",
  genomes: 9_500_841,
  lineage_ids: [10239, 2559587, 2732396, 2732408, 2732506, 76804, 2499399, 11118],
  lineage_names: [
    "Viruses",
    "Riboviria",
    "Orthornavirae",
    "Pisuviricota",
    "Pisoniviricetes",
    "Nidovirales",
    "Cornidovirineae",
    "Coronaviridae",
  ],
  lineage_ranks: [
    "acellular root",
    "realm",
    "kingdom",
    "phylum",
    "class",
    "order",
    "suborder",
    "family",
  ],
};

function taxonomyMatches(doc: Record<string, unknown>) {
  return {
    taxonomy: { result: { response: { numFound: 1, docs: [doc] } } },
  };
}

describe("search lineage matches the taxon breadcrumb (DXKBCORE-406)", () => {
  const breadcrumbNames = taxonViewHeader({
    taxonId: coronaviridae.taxon_id,
    lineageIds: coronaviridae.lineage_ids,
    lineageNames: coronaviridae.lineage_names,
    lineageRanks: coronaviridae.lineage_ranks,
  }).ancestors.map((crumb) => crumb.name);

  it("the breadcrumb ancestors for Coronaviridae are the rank-filtered ones", () => {
    expect(breadcrumbNames).toEqual([
      "Pisuviricota",
      "Pisoniviricetes",
      "Nidovirales",
    ]);
  });

  it("the best match parents equal the breadcrumb ancestors", () => {
    const { bestMatch } = toAllTypesResults(
      taxonomyMatches(coronaviridae),
      "Coronaviridae",
    );
    expect(bestMatch?.parents).toEqual(breadcrumbNames);
  });

  it("the Taxa row context equals the breadcrumb ancestors joined with ›", () => {
    const { types } = toAllTypesResults(
      taxonomyMatches(coronaviridae),
      "Coronaviridae",
    );
    const row = types.find((type) => type.id === "taxonomy")?.rows[0];
    expect(row?.context).toBe(breadcrumbNames.join(" › "));
  });

  it("shows no lineage when the arrays are not aligned, as the breadcrumb does", () => {
    const misaligned = {
      ...coronaviridae,
      lineage_ranks: coronaviridae.lineage_ranks.slice(0, -1),
    };
    const { bestMatch, types } = toAllTypesResults(
      taxonomyMatches(misaligned),
      "Coronaviridae",
    );
    expect(bestMatch?.parents).toEqual([]);
    expect(types.find((type) => type.id === "taxonomy")?.rows[0]?.context).toBe(
      "",
    );
  });

  it("shows no lineage when a doc has no ranks", () => {
    const withoutRanks = { ...coronaviridae, lineage_ranks: undefined };
    const { bestMatch } = toAllTypesResults(
      taxonomyMatches(withoutRanks),
      "Coronaviridae",
    );
    expect(bestMatch?.parents).toEqual([]);
  });
});

describe("formatCompact", () => {
  it("shortens large counts", () => {
    expect(formatCompact(2_234_567)).toBe("2.2M");
    expect(formatCompact(12)).toBe("12");
  });
});

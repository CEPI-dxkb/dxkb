import { NextRequest, NextResponse } from "next/server";
import { handleIdentityGet, handleIdentityPost } from "./identity";

/**
 * Loopback mock for Playwright e2e only.
 *
 * Server components and API route handlers call backends (APP_SERVICE_URL,
 * WORKSPACE_API_URL, USER_URL, ...) at request time. Those outbound fetches
 * never pass through `page.route()`, so without this catch-all the test
 * server emits "HTTP error! status: 500" for every render. During e2e,
 * .env.e2e.test points every backend URL here and this handler returns
 * endpoint-specific identity responses plus deterministic service fixtures.
 *
 * Guarded by E2E_MOCK_ENABLED=1 so a production deploy that somehow ships
 * this file still can't be tricked into serving fake backend responses.
 */

function isEnabled(): boolean {
  return process.env.E2E_MOCK_ENABLED === "1";
}

function disabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "Mock endpoint disabled" },
    { status: 404 },
  );
}

function resolvePath(params: Promise<{ path: string[] }>): Promise<string> {
  return params.then((p) => p.path.join("/"));
}

function logHit(method: string, path: string, extra?: string): void {
  const tail = extra ? ` ${extra}` : "";
  console.log(`[api/e2e-mock] ${method} /${path}${tail}`);
}

const e2eDeterministicCounts: Record<string, number> = {
  genome: 12345,
  genome_feature: 67890,
  taxonomy: 23456,
  epitope: 7890,
  protein_structure: 4567,
  protein_feature: 8901,
  experiment: 1,
  ppi: 4358,
};

const proteinStructureRecordFixtures = [
  {
    pdb_id: "6VXX",
    title: "SARS-CoV-2 spike glycoprotein",
    organism_name: "Severe acute respiratory syndrome coronavirus 2",
    taxon_id: 2697049,
    taxon_lineage_ids: [10239, 2697049],
    taxon_lineage_names: ["Viruses", "Betacoronavirus pandemicum"],
    genome_id: "2697049.42",
    patric_id: "fig|2697049.42.peg.1",
    uniprotkb_accession: ["P0DTC2"],
    gene: "S",
    product: "surface glycoprotein",
    sequence_md5: "e2e6vxxsequence",
    method: "Electron microscopy",
    resolution: 2.8,
    pmid: 32155444,
    institution: ["University of Texas at Austin"],
    authors: ["Walls AC"],
    release_date: "2020-03-25",
    file_path: "/PDB/6VXX.pdb",
    date_inserted: "2024-01-01",
  },
  {
    pdb_id: "7BV2",
    title: "RNA-dependent RNA polymerase in complex with remdesivir",
    organism_name: "Severe acute respiratory syndrome coronavirus 2",
    taxon_id: 2697049,
    method: "Electron microscopy",
    resolution: 2.5,
    release_date: "2020-05-20",
    file_path: "/PDB/7BV2.pdb",
    date_inserted: "2024-01-02",
  },
];

const epitopeRecordFixture = {
  epitope_id: "15780",
  epitope_type: "Discontinuous peptide",
  epitope_sequence: "A1, C4, D8",
  organism: "Influenza A virus",
  taxon_id: 11520,
  taxon_lineage_ids: [10239, 11520],
  protein_name: "Hemagglutinin",
  protein_accession: "P03452",
  host_name: "Human",
  total_assays: 2,
  assay_results: ["Positive", "Negative"],
  bcell_assays: 2,
  tcell_assays: 0,
  mhc_assays: 0,
  comments: "Discontinuous residues",
  date_inserted: "2024-01-01",
};

const experimentRecordFixture = {
  exp_id: "2000000",
  study_name: "E2E host response study",
  study_title: "Host response to viral infection",
  study_description: "A deterministic experiment fixture.",
  study_pi: "Ada Scientist",
  study_institution: "Research Institute",
  exp_name: "E2E-RNA-1",
  exp_title: "RNA response experiment",
  exp_description: "Differential expression after infection.",
  public_repository: "GEO",
  public_identifier: "GSE2000000",
  pmid: "12345678",
  exp_type: "Transcript Quantification",
  measurement_technique: "RNA-Seq",
  organism: ["Middle East respiratory syndrome-related coronavirus"],
  taxon_id: [1335626],
  taxon_lineage_ids: [10239, 1335626],
  strain: ["E2E strain"],
  treatment_type: ["Infectious Agent"],
  treatment_name: ["Virus infection"],
  samples: 6,
  biosets: 1,
  genome_id: ["1282460.2049"],
  date_inserted: "2024-01-01",
};

const surveillanceRecordFixture = {
  id: "surveillance-backend-901",
  sample_identifier: "sample/1",
  contributing_institution: "Sentinel Health Laboratory",
  sample_material: "Nasal swab",
  collection_date: "2024-07",
  collection_year: 2024,
  collection_country: "Australia",
  collection_state_province: "New South Wales",
  collection_latitude: "-33.45",
  collection_longitude: "151.2",
  pathogen_test_type: ["RAT/antigen"],
  pathogen_test_result: ["Positive"],
  pathogen_test_interpretation: ["Detected"],
  pathogen_type: "SARS-CoV-2",
  host_identifier: "host-42",
  host_common_name: "Human",
};

const ambiguousSurveillanceFixtures = [
  {
    id: "surveillance-backend-902",
    sample_identifier: "ambiguous-sample",
    pathogen_test_type: ["PCR"],
  },
  {
    id: "surveillance-backend-903",
    sample_identifier: "ambiguous-sample",
    pathogen_test_type: ["RAT/antigen"],
  },
];

const serologyRecordFixture = {
  id: "serology-backend-901",
  sample_identifier: "000123",
  contributing_institution: "Sentinel Serology Laboratory",
  host_identifier: "host-42",
  host_type: "Human",
  host_species: "Homo sapiens",
  host_common_name: "Human",
  collection_date: "2024-07",
  collection_year: 2024,
  collection_country: "Australia",
  collection_state: "New South Wales",
  test_type: "ELISA/IgG test",
  test_result: "Detected",
  test_interpretation: "Evidence of prior exposure; confirm clinically",
  serotype: "H1N1",
};

const ambiguousSerologyFixtures = [
  {
    id: "serology-backend-902",
    sample_identifier: "ambiguous-serology",
    test_type: "Western blot",
  },
  {
    id: "serology-backend-903",
    sample_identifier: "ambiguous-serology",
    test_type: "ELISA/IgG test",
  },
];

const genomeRecordFixture = {
  genome_id: "1282460.2049",
  genome_name: "Middle East respiratory syndrome-related coronavirus isolate",
  strain: "MERS-CoV",
  superkingdom: "Viruses",
  genome_status: "Complete",
  genome_quality: "Good",
  genome_length: 30_119,
  contigs: 1,
  cds: 11,
  collection_year: 2012,
  isolation_country: "Saudi Arabia",
  host_common_name: "Human",
  genbank_accessions: ["JX869059"],
  taxon_id: 1335626,
  taxon_lineage_ids: [10239, 1335626],
  taxon_lineage_names: [
    "Viruses",
    "Middle East respiratory syndrome-related coronavirus",
  ],
};

function maybeSolrCount(
  path: string,
  request: NextRequest,
):
  | {
      response: {
        numFound: number;
        docs: Record<string, unknown>[];
      };
      facet_counts?: { facet_fields: Record<string, unknown[]> };
    }
  | Record<string, unknown>[]
  | null {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "data" || segments.length < 2) return null;
  const core = segments[1];
  const query = decodeURIComponent(new URL(request.url).search);
  if (core === "serology") {
    const isAmbiguous = query.includes(
      "eq(sample_identifier,ambiguous-serology)",
    );
    const hasTestTypeFilter = query.includes("eq(test_type,");
    const requestedTestType = ambiguousSerologyFixtures
      .map((fixture) => fixture.test_type)
      .find((testType) => query.includes(`eq(test_type,${testType})`));
    const docs = isAmbiguous
      ? requestedTestType
        ? ambiguousSerologyFixtures.filter(
            (fixture) => fixture.test_type === requestedTestType,
          )
        : hasTestTypeFilter
          ? []
          : ambiguousSerologyFixtures
      : query.includes("eq(sample_identifier,000123)") ||
          query.includes("keyword(antibody*)")
        ? [serologyRecordFixture]
        : [];
    if (request.headers.get("accept") === "application/json") return docs;
    return {
      response: { numFound: docs.length, docs },
      facet_counts: {
        facet_fields: {
          test_type: isAmbiguous
            ? docs.flatMap((fixture) => [fixture.test_type, 1])
            : ["ELISA/IgG test", 1],
        },
      },
    };
  }
  if (core === "experiment") {
    const experimentId = query.match(/eq\(exp_id,([^)&]+)\)/)?.[1];
    const docs =
      experimentId && experimentId !== "*"
        ? experimentId === experimentRecordFixture.exp_id
          ? [experimentRecordFixture]
          : []
        : [experimentRecordFixture];
    if (request.headers.get("accept") === "application/json") return docs;
    return { response: { numFound: docs.length, docs } };
  }
  if (core === "protein_structure") {
    const accession = query.match(/eq\(pdb_id,([^)&]+)\)/)?.[1];
    const docs =
      accession === "*"
        ? proteinStructureRecordFixtures
        : accession
          ? proteinStructureRecordFixtures.filter(
              (record) => record.pdb_id === accession,
            )
          : proteinStructureRecordFixtures;
    if (request.headers.get("accept") === "application/json") return docs;
    return { response: { numFound: docs.length, docs } };
  }
  if (core === "surveillance") {
    const isAmbiguous = query.includes(
      "eq(sample_identifier,ambiguous-sample)",
    );
    const hasTestTypeFilter = query.includes("eq(pathogen_test_type,");
    const requestedTestType = ambiguousSurveillanceFixtures
      .flatMap((fixture) => fixture.pathogen_test_type)
      .find((testType) =>
        query.includes(`eq(pathogen_test_type,"${testType}")`),
      );
    const docs = isAmbiguous
      ? requestedTestType
        ? ambiguousSurveillanceFixtures.filter((fixture) =>
            fixture.pathogen_test_type.includes(requestedTestType),
          )
        : hasTestTypeFilter
          ? []
          : ambiguousSurveillanceFixtures
      : query.includes("eq(sample_identifier,sample/1)")
        ? [surveillanceRecordFixture]
        : query.includes("keyword(sentinel*)")
          ? [surveillanceRecordFixture]
          : [];
    if (request.headers.get("accept") === "application/json") return docs;
    return {
      response: { numFound: docs.length, docs },
      facet_counts: {
        facet_fields: {
          pathogen_test_type: isAmbiguous
            ? docs.flatMap((fixture) => [fixture.pathogen_test_type[0], 1])
            : ["RAT/antigen", 1],
        },
      },
    };
  }
  const numFound = e2eDeterministicCounts[core];
  if (typeof numFound !== "number") return null;
  const isGenomeFixtureQuery =
    core === "genome" &&
    (query.includes("eq(genome_id,1282460.2049)") ||
      (query.includes("keyword(MERS*)") &&
        query.includes("sort(+genome_name,+genome_id)")));
  const itemRange = (
    request.headers.get("range") ?? request.headers.get("x-range")
  )?.match(/^items=(\d+)-(\d+)$/i);
  const includesFixtureRow =
    !itemRange || (Number(itemRange[1]) <= 0 && Number(itemRange[2]) >= 0);
  const isEpitopeFixtureQuery =
    core === "epitope" && query.includes("eq(epitope_id,15780)");
  const docs = includesFixtureRow
    ? isGenomeFixtureQuery
      ? [genomeRecordFixture]
      : isEpitopeFixtureQuery
        ? [epitopeRecordFixture]
        : []
    : [];
  if (request.headers.get("accept") === "application/json") return docs;
  return { response: { numFound, docs } };
}

const bacteriaSummaryFixture = {
  count: 1337420,
  unique_family: 391,
  unique_genus: 5432,
  unique_species: 82915,
  CDS: 482001224,
  mat_peptide: 23144,
  PDB: 9821,
};

const virusesSummaryFixture = {
  count: 890123,
  unique_family: 212,
  unique_genus: 2841,
  unique_species: 14302,
  CDS: 12803441,
  mat_peptide: 419820,
  PDB: 3201,
};

const allOrganismsSummaryFixture = {
  count: 9800000,
  unique_family: 1204,
  unique_genus: 41200,
  unique_species: 510000,
  CDS: 980000000,
  mat_peptide: 450000,
  PDB: 21000,
};

const bacteriaTaxonomyFixture = {
  taxon_id: 2,
  taxon_name: "Bacteria",
  lineage_names: ["cellular organisms", "Bacteria"],
  lineage_ids: [131567, 2],
  taxon_rank: "superkingdom",
  genomes: 1337420,
};

const virusesTaxonomyFixture = {
  taxon_id: 10239,
  taxon_name: "Viruses",
  lineage_names: ["Viruses"],
  lineage_ids: [10239],
  taxon_rank: "superkingdom",
  genomes: virusesSummaryFixture.count,
};

const cellularOrganismsTaxonomyFixture = {
  taxon_id: 131567,
  taxon_name: "cellular organisms",
  lineage_names: ["cellular organisms"],
  lineage_ids: [131567],
  taxon_rank: "no rank",
  genomes: allOrganismsSummaryFixture.count,
};

const brucellaTaxonomyFixture = {
  taxon_id: 234,
  taxon_name: "Brucella",
  lineage_names: [
    "cellular organisms",
    "Bacteria",
    "Pseudomonadota",
    "Alphaproteobacteria",
    "Hyphomicrobiales",
    "Brucellaceae",
    "Brucella",
  ],
  lineage_ids: [131567, 2, 1224, 28211, 356, 118882, 234],
  taxon_rank: "genus",
  genomes: 1909,
};

// Influenza A virus — lineage includes "Orthomyxoviridae" so hasStrains = true.
// Used by the strains-tab e2e tests which need a taxon where the Strains tab is enabled.
const influenzaATaxonomyFixture = {
  taxon_id: 11520,
  taxon_name: "Influenza A virus",
  lineage_names: [
    "Viruses",
    "Orthornavirae",
    "Negarnaviricota",
    "Insthoviricetes",
    "Articulavirales",
    "Orthomyxoviridae",
    "Alphainfluenzavirus",
    "Influenza A virus",
  ],
  lineage_ids: [
    10239, 2497569, 2497570, 2497583, 2499399, 11308, 2499397, 11520,
  ],
  taxon_rank: "species",
  genomes: 245000,
};

// Alphainfluenzavirus influenzae — lineage includes "Alphainfluenzavirus influenzae"
// so hasSerology = true. Used by the serology-tab e2e test.
const alphainfluenzavirusInfluenzaeTaxonomyFixture = {
  taxon_id: 2955291,
  taxon_name: "Alphainfluenzavirus influenzae",
  lineage_names: [
    "Viruses",
    "Riboviria",
    "Orthornavirae",
    "Negarnaviricota",
    "Polyploviricotina",
    "Insthoviricetes",
    "Articulavirales",
    "Orthomyxoviridae",
    "Alphainfluenzavirus",
    "Alphainfluenzavirus influenzae",
  ],
  lineage_ids: [
    10239, 2559587, 2732396, 2497569, 2497571, 2497577, 2499411, 11308, 197911,
    2955291,
  ],
  taxon_rank: "species",
  genomes: 1876178,
};

// Caliciviridae — virus family used by domains-and-motifs e2e tests.
const caliciviridaeTaxonomyFixture = {
  taxon_id: 11974,
  taxon_name: "Caliciviridae",
  lineage_names: [
    "Viruses",
    "Riboviria",
    "Orthornavirae",
    "Pisuviricota",
    "Pisoniviricetes",
    "Picornavirales",
    "Caliciviridae",
  ],
  lineage_ids: [10239, 2559587, 2732396, 2732408, 2732506, 464095, 11974],
  taxon_rank: "family",
  genomes: 86222,
};

const sharedFacetFixtures: Record<string, (string | number)[]> = {
  genus: [
    "Escherichia",
    128450,
    "Klebsiella",
    74231,
    "Streptococcus",
    68814,
    "Mycobacterium",
    55820,
    "Salmonella",
    53994,
    "Staphylococcus",
    47780,
    "Pseudomonas",
    39210,
    "Bacillus",
    35892,
    "Acinetobacter",
    30122,
    "Enterococcus",
    26750,
    "Clostridium",
    23220,
    "Lactobacillus",
    20540,
    "Vibrio",
    18812,
    "Campylobacter",
    16204,
    "Listeria",
    13920,
    "Bordetella",
    11204,
    "Neisseria",
    10772,
    "Corynebacterium",
    10013,
    "Shigella",
    9481,
    "Yersinia",
    8190,
    "Brucella",
    7604,
    "Legionella",
    6901,
    "Francisella",
    5488,
    "Rickettsia",
    4312,
  ],
  isolation_country_geo: [
    "USA",
    260,
    "China",
    260,
    "Italy",
    188,
    "India",
    108,
    "Israel",
    107,
  ],
  state_province: [
    "Wyoming",
    48,
    "Idaho",
    35,
    "Texas",
    24,
    "Montana",
    23,
    "Georgia",
    16,
  ],
  county: ["Los Angeles", 12, "Harris", 8],
  host_name: [
    "Homo sapiens",
    401232,
    "Bos taurus",
    88411,
    "Sus scrofa",
    63411,
    "Gallus gallus",
    51003,
    "Mus musculus",
    29110,
    "Environment",
    14420,
  ],
  host_group: [
    "Human",
    512004,
    "Animal",
    231880,
    "Environment",
    98120,
    "Plant",
    41230,
    "Insect",
    29801,
  ],
  isolation_country: [
    "United States",
    290442,
    "China",
    162001,
    "United Kingdom",
    91230,
    "Germany",
    70612,
    "Canada",
    56640,
    "Brazil",
    42801,
  ],
  family: [
    "Coronaviridae",
    180204,
    "Flaviviridae",
    98041,
    "Orthomyxoviridae",
    84312,
    "Paramyxoviridae",
    61203,
    "Retroviridae",
    52810,
    "Rhabdoviridae",
    41002,
    "Herpesviridae",
    38901,
    "Adenoviridae",
    29410,
    "Poxviridae",
    21034,
    "Picornaviridae",
    18920,
  ],
  sequencing_centers: [
    "SC",
    353,
    "Centers for Disease Control and Prevention",
    264,
    "University of Helsinki",
    245,
    "University of California at Davis",
    154,
    "FDA/CFSAN",
    125,
    "Swansea University",
    118,
    "Michigan State University",
    94,
    "US Food and Drug Administration",
    88,
    "USDA FSIS",
    78,
  ],
};

function facetFieldFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const candidates = [
    url.search,
    ...Array.from(url.searchParams.keys()),
    ...Array.from(url.searchParams.values()),
  ].map((value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  });

  for (const candidate of candidates) {
    const match = candidate.match(/\(field,([^),=]+)\)/);
    if (match?.[1]) return match[1];
  }

  return null;
}

interface PivotKey {
  primary: string;
  secondary: string;
  tertiary?: string;
}

function pivotKeyFromRequest(request: NextRequest): PivotKey | null {
  const url = new URL(request.url);
  const candidates = [
    url.search,
    ...Array.from(url.searchParams.keys()),
    ...Array.from(url.searchParams.values()),
  ].map((value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  });

  for (const candidate of candidates) {
    // `[^,)]+` prevents `(...,foo)),(mincount,1)` from being misread as a
    // 3-level pivot by greedily consuming the close paren of the inner pivot.
    const triple = candidate.match(/\(pivot,\(([^,)]+),([^,)]+),([^,)]+)\)\)/);
    if (triple?.[1] && triple[2] && triple[3]) {
      return { primary: triple[1], secondary: triple[2], tertiary: triple[3] };
    }
    const match = candidate.match(/\(pivot,\(([^,)]+),([^,)]+)\)\)/);
    if (match?.[1] && match[2])
      return { primary: match[1], secondary: match[2] };
  }

  return null;
}

// Shared county fixture consumed by BOTH the 2-level state_province,county pivot
// AND the 3-level state_province,county,genus pivot. Having a single source of
// truth ensures county names match across both pivots so fetchOrganismGeoDistribution
// can successfully join count data to tooltip genera. "Park" county appears in
// both Wyoming and Idaho to exercise state-scoped lookups (same county name,
// different state → different genus set).
const countyGeoFixtures: {
  state: string;
  county: string;
  count: number;
  genus: string;
}[] = [
  { state: "Wyoming", county: "Park", count: 30, genus: "Brucella" },
  { state: "Wyoming", county: "Teton", count: 18, genus: "Bordetella" },
  { state: "Idaho", county: "Ada", count: 22, genus: "Brucella" },
  { state: "Idaho", county: "Park", count: 13, genus: "Listeria" },
  { state: "Texas", county: "Harris", count: 14, genus: "Brucella" },
  { state: "Montana", county: "Yellowstone", count: 12, genus: "Bordetella" },
  { state: "Georgia", county: "Fulton", count: 9, genus: "Listeria" },
];

function solrPivot(primary: string, secondary: string) {
  const counts =
    sharedFacetFixtures[
      primary === "isolation_country" ? "isolation_country_geo" : primary
    ] ?? [];
  const pivots: {
    field: string;
    value: string;
    count: number;
    pivot: { field: string; value: string; count: number }[];
  }[] = [];
  for (let i = 0; i < counts.length; i += 2) {
    const value = counts[i] as string;
    const count = counts[i + 1] as number;
    pivots.push({
      field: primary,
      value,
      count,
      pivot: [
        {
          field: secondary,
          value: secondary === "genus" ? "Brucella" : "Human",
          count,
        },
      ],
    });
  }
  return {
    response: {
      numFound: pivots.reduce((sum, p) => sum + p.count, 0),
      docs: [],
    },
    facet_counts: {
      facet_pivot: {
        [`${primary},${secondary}`]: pivots,
      },
    },
  };
}

function solrStateCountyPivot(fixtures: typeof countyGeoFixtures) {
  const byState = new Map<string, { county: string; count: number }[]>();
  for (const row of fixtures) {
    const counties = byState.get(row.state) ?? [];
    counties.push({ county: row.county, count: row.count });
    byState.set(row.state, counties);
  }
  const pivots = Array.from(byState.entries()).map(([state, counties]) => ({
    field: "state_province",
    value: state,
    count: counties.reduce((s, c) => s + c.count, 0),
    pivot: counties.map((c) => ({
      field: "county",
      value: c.county,
      count: c.count,
    })),
  }));
  return {
    response: {
      numFound: pivots.reduce((sum, p) => sum + p.count, 0),
      docs: [],
    },
    facet_counts: {
      facet_pivot: {
        "state_province,county": pivots,
      },
    },
  };
}

function solrStateCountyGenusPivot(fixtures: typeof countyGeoFixtures) {
  const byState = new Map<
    string,
    { county: string; count: number; genus: string }[]
  >();
  for (const row of fixtures) {
    const counties = byState.get(row.state) ?? [];
    counties.push({ county: row.county, count: row.count, genus: row.genus });
    byState.set(row.state, counties);
  }
  const pivots = Array.from(byState.entries()).map(([state, counties]) => ({
    field: "state_province",
    value: state,
    count: counties.reduce((s, c) => s + c.count, 0),
    pivot: counties.map((c) => ({
      field: "county",
      value: c.county,
      count: c.count,
      pivot: [{ field: "genus", value: c.genus, count: c.count }],
    })),
  }));
  return {
    response: {
      numFound: pivots.reduce((sum, p) => sum + p.count, 0),
      docs: [],
    },
    facet_counts: {
      facet_pivot: {
        "state_province,county,genus": pivots,
      },
    },
  };
}

// Exact pivot keys the app constructs today. Anything not in this set returns
// 400 so e2e surfaces typos in pivot field names instead of silently rendering
// synthesized data for a shape the app never asks for. Update this when a new
// pivot caller is added (cross-reference the `(pivot,(` matches in
// src/lib/services/organisms/).
const supportedPivotKeys = new Set<string>([
  "isolation_country,genus",
  "isolation_country,host_common_name",
  "state_province,genus",
  "state_province,host_common_name",
  "state_province,county",
  "state_province,county,genus",
  "collection_year,serovar",
]);

function solrSerotypePivot() {
  // collection_year,serovar uses numeric outer keys in real SOLR responses;
  // the parser at parseSolrFacetPivot coerces them to string keys. Build a
  // small window of years × two serovars so the serotype reducer in
  // src/lib/services/organisms/serotype-distribution.ts has something to
  // collapse into "top serovars" rows.
  const years = [2019, 2020, 2021, 2022, 2023];
  const pivots = years.map((year, idx) => ({
    field: "collection_year",
    value: year,
    count: 100 + idx * 10,
    pivot: [
      { field: "serovar", value: "Typhimurium", count: 60 + idx * 5 },
      { field: "serovar", value: "Enteritidis", count: 40 + idx * 5 },
    ],
  }));
  return {
    response: {
      numFound: pivots.reduce((sum, p) => sum + p.count, 0),
      docs: [],
    },
    facet_counts: {
      facet_pivot: {
        "collection_year,serovar": pivots,
      },
    },
  };
}

function solrFacet(field: string, count: number) {
  // The geographic isolation_country fixture uses different fixture data than
  // the metadata-distribution one (real values from BV-BRC for Brucella), so
  // detect "geo" callers by their use of the geo-specific pivot helpers.
  // Here we serve the regular fixture by name and a richer one keyed on _geo.
  const values = sharedFacetFixtures[field] ?? [];
  return {
    response: { numFound: count, docs: [] },
    facet_counts: {
      facet_fields: {
        [field]: values,
      },
    },
  };
}

const referenceGenomesFixture: Record<string, unknown>[] = [
  {
    genome_id: "234.1",
    genome_name: "Brucella suis 1330",
    reference_genome: "Reference",
  },
  {
    genome_id: "234.2",
    genome_name: "Brucella abortus 2308",
    reference_genome: "Reference",
  },
  {
    genome_id: "234.3",
    genome_name: "Brucella melitensis 16M",
    reference_genome: "Representative",
  },
  {
    genome_id: "234.4",
    genome_name: "Brucella canis ATCC 23365",
    reference_genome: "Representative",
  },
];

const amrAntibioticFixtures: {
  antibiotic: string;
  Resistant: number;
  Susceptible: number;
  Intermediate: number;
}[] = [
  { antibiotic: "ampicillin", Resistant: 75, Susceptible: 40, Intermediate: 5 },
  {
    antibiotic: "ciprofloxacin",
    Resistant: 30,
    Susceptible: 60,
    Intermediate: 10,
  },
  {
    antibiotic: "tetracycline",
    Resistant: 45,
    Susceptible: 50,
    Intermediate: 5,
  },
  {
    antibiotic: "streptomycin",
    Resistant: 20,
    Susceptible: 70,
    Intermediate: 10,
  },
];

function buildAmrFixtureBody(): Record<string, unknown> {
  const pivots = amrAntibioticFixtures.map((row) => {
    const innerPivots = [
      {
        field: "resistant_phenotype",
        value: "Resistant",
        count: row.Resistant,
      },
      {
        field: "resistant_phenotype",
        value: "Susceptible",
        count: row.Susceptible,
      },
      {
        field: "resistant_phenotype",
        value: "Intermediate",
        count: row.Intermediate,
      },
    ].filter((p) => p.count > 0);
    return {
      field: "antibiotic",
      value: row.antibiotic,
      count: row.Resistant + row.Susceptible + row.Intermediate,
      pivot: innerPivots,
    };
  });
  return {
    response: {
      numFound: pivots.reduce((sum, p) => sum + p.count, 0),
      docs: [],
    },
    facet_counts: {
      facet_pivot: {
        "antibiotic,resistant_phenotype": pivots,
      },
    },
  };
}

interface AmrPostValidation {
  ok: boolean;
  reason?: string;
}

function validateAmrPostBody(body: string): AmrPostValidation {
  const requiredFragments = [
    "eq(taxon_lineage_ids,",
    "in(resistant_phenotype,",
    "facet((pivot,(antibiotic,resistant_phenotype))",
  ];
  for (const fragment of requiredFragments) {
    if (!body.includes(fragment)) {
      return {
        ok: false,
        reason: `missing required RQL fragment: ${fragment}`,
      };
    }
  }
  return { ok: true };
}

async function maybeBvBrcWebsitePost(
  path: string,
  request: NextRequest,
): Promise<BvBrcResult | null> {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "bvbrc-website") return null;
  const endpoint = segments.slice(1).join("/");

  if (endpoint === "genome_amr" || endpoint === "genome_amr/") {
    const body = await request.clone().text();
    const validation = validateAmrPostBody(body);
    if (!validation.ok) {
      return {
        kind: "unhandled",
        reason: validation.reason ?? "invalid amr body",
      };
    }
    return { kind: "ok", body: buildAmrFixtureBody() };
  }

  return null;
}

type BvBrcResult =
  { kind: "ok"; body: unknown } | { kind: "unhandled"; reason: string };

function maybeBvBrcWebsite(
  path: string,
  request: NextRequest,
): BvBrcResult | null {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "bvbrc-website") return null;
  const endpoint = segments.slice(1).join("/");

  if (endpoint === "data/summary_by_taxon/2")
    return { kind: "ok", body: bacteriaSummaryFixture };
  if (endpoint === "data/summary_by_taxon/10239")
    return { kind: "ok", body: virusesSummaryFixture };
  if (endpoint === "data/summary_by_taxon/131567")
    return { kind: "ok", body: allOrganismsSummaryFixture };
  if (endpoint === "taxonomy/2")
    return { kind: "ok", body: bacteriaTaxonomyFixture };
  if (endpoint === "taxonomy/10239")
    return { kind: "ok", body: virusesTaxonomyFixture };
  if (endpoint === "taxonomy/131567")
    return { kind: "ok", body: cellularOrganismsTaxonomyFixture };
  if (endpoint === "taxonomy/234")
    return { kind: "ok", body: brucellaTaxonomyFixture };
  if (endpoint === "taxonomy/11520")
    return { kind: "ok", body: influenzaATaxonomyFixture };
  if (endpoint === "taxonomy/11974")
    return { kind: "ok", body: caliciviridaeTaxonomyFixture };
  if (endpoint === "taxonomy/2955291")
    return { kind: "ok", body: alphainfluenzavirusInfluenzaeTaxonomyFixture };
  if (endpoint === "genome" || endpoint === "genome/") {
    const url = new URL(request.url);
    const query = decodeURIComponent(url.search);

    // Reference-genomes endpoint: BV-BRC returns a bare array of docs
    // (json(nl,map)), not the SOLR envelope shape.
    if (query.includes("reference_genome,*") && query.includes("select(")) {
      return { kind: "ok", body: referenceGenomesFixture };
    }

    // Use a strict regex to avoid substring collisions as fixture IDs grow
    // (e.g. "234" should not match a taxon "1234").
    const taxonMatch = query.match(/eq\(taxon_lineage_ids,(\d+)\)/);
    const taxonId = taxonMatch ? Number(taxonMatch[1]) : null;

    const pivot = pivotKeyFromRequest(request);
    if (pivot) {
      const pivotKey = pivot.tertiary
        ? `${pivot.primary},${pivot.secondary},${pivot.tertiary}`
        : `${pivot.primary},${pivot.secondary}`;
      if (!supportedPivotKeys.has(pivotKey)) {
        return {
          kind: "unhandled",
          reason: `unsupported pivot key '${pivotKey}'`,
        };
      }
      if (pivotKey === "collection_year,serovar") {
        return { kind: "ok", body: solrSerotypePivot() };
      }
      if (pivotKey === "state_province,county,genus") {
        return {
          kind: "ok",
          body: solrStateCountyGenusPivot(countyGeoFixtures),
        };
      }
      if (pivot.tertiary) {
        // This branch is unreachable today — supportedPivotKeys only allows
        // state_province,county,genus as a 3-level pivot, which is handled above.
        // Kept as a safety net if a new 3-level pivot is ever added without a
        // dedicated builder.
        return {
          kind: "unhandled",
          reason: `no dedicated builder for 3-level pivot '${pivotKey}'`,
        };
      }
      if (pivotKey === "state_province,county") {
        return { kind: "ok", body: solrStateCountyPivot(countyGeoFixtures) };
      }
      return { kind: "ok", body: solrPivot(pivot.primary, pivot.secondary) };
    }
    const field = facetFieldFromRequest(request);
    if (!field) {
      return { kind: "unhandled", reason: "no pivot or facet field" };
    }
    let count = bacteriaSummaryFixture.count;
    if (taxonId === 10239) count = virusesSummaryFixture.count;
    else if (taxonId === 131567) count = allOrganismsSummaryFixture.count;
    if (field === "isolation_country" && taxonId === 234) {
      return {
        kind: "ok",
        body: {
          response: { numFound: count, docs: [] },
          facet_counts: {
            facet_fields: {
              isolation_country: sharedFacetFixtures.isolation_country_geo,
            },
          },
        },
      };
    }
    return { kind: "ok", body: solrFacet(field, count) };
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isEnabled()) return disabledResponse();
  const path = await resolvePath(context.params);
  logHit("GET", path);
  if (path === "phylo-manifest") {
    return NextResponse.json({ trees: { "2955291": "influenza" } });
  }
  const identityResponse = handleIdentityGet(path);
  if (identityResponse) return identityResponse;
  const bvBrcWebsite = maybeBvBrcWebsite(path, request);
  if (bvBrcWebsite) {
    if (bvBrcWebsite.kind === "unhandled") {
      // Fail loudly so e2e tests surface fixture gaps instead of silently
      // rendering empty data.
      return NextResponse.json(
        {
          error: "e2e-mock: unhandled bvbrc-website/genome query",
          reason: bvBrcWebsite.reason,
          query: new URL(request.url).search,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(bvBrcWebsite.body);
  }
  const solr = maybeSolrCount(path, request);
  if (solr) return NextResponse.json(solr);
  return NextResponse.json({});
}

// Permissive POST fallback is reserved for the known JSON-RPC / service
// namespaces wired through .env.e2e.test so an unexpected POST routed through
// this mock fails loudly rather than silently returning success. The
// `bvbrc-website` namespace is intentionally excluded from this fallback —
// the only supported POST endpoint there is `genome_amr`, which is handled
// explicitly by `maybeBvBrcWebsitePost` above this fallback. Every other
// `bvbrc-website` POST still fails loudly.
const postAllowedNamespaces = new Set([
  "workspace",
  "app-service",
  "service",
  "services",
  "data",
  "data-service",
  "sra-validation",
  "minhash",
  "upload",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isEnabled()) return disabledResponse();
  const path = await resolvePath(context.params);

  let rpcMethod: string | undefined;
  try {
    const body = (await request.clone().json()) as { method?: unknown } | null;
    if (body && typeof body.method === "string") rpcMethod = body.method;
  } catch {
    // Non-JSON body (e.g. form upload) — fine, just skip method logging.
  }

  logHit("POST", path, rpcMethod ? `method=${rpcMethod}` : "");

  const bvBrcWebsitePost = await maybeBvBrcWebsitePost(path, request);
  if (bvBrcWebsitePost) {
    if (bvBrcWebsitePost.kind === "unhandled") {
      return NextResponse.json(
        {
          error: "e2e-mock: invalid bvbrc-website/genome_amr POST",
          reason: bvBrcWebsitePost.reason,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(bvBrcWebsitePost.body);
  }

  const identityResponse = await handleIdentityPost(path, request, rpcMethod);
  if (identityResponse) return identityResponse;

  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  if (!postAllowedNamespaces.has(firstSegment)) {
    return NextResponse.json(
      { error: "e2e-mock: unhandled POST endpoint", path },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
}

export async function PUT(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isEnabled()) return disabledResponse();
  const path = await resolvePath(context.params);
  logHit("PUT", path);
  return NextResponse.json({});
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isEnabled()) return disabledResponse();
  const path = await resolvePath(context.params);
  logHit("DELETE", path);
  return NextResponse.json({});
}

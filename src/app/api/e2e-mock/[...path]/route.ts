import { NextRequest, NextResponse } from "next/server";
import { handleIdentityGet, handleIdentityPost } from "./identity";
import {
  allOrganismsSummaryRecord,
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
  bacteriaSummaryRecord,
  brucellaPpiTotal,
  epitopeRecord,
  experimentRecord,
  findOrganismSummaryRecord,
  findOrganismTaxonomyRecord,
  genomeRecord,
  proteinStructureRecords,
  serologyRecord,
  surveillanceRecord,
  taxonomyRecord,
  virusesSummaryRecord,
} from "@/lib/e2e-fixtures/records";
import { buildLoopbackSolrEnvelope } from "@/lib/e2e-fixtures/envelopes";
import {
  equalsValue,
  hasCall,
  hasClause,
  hasKeyword,
  parseFixtureQuery,
  type FixtureQuery,
} from "./query";

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
  ppi: brucellaPpiTotal,
};

function maybeSolrCount(
  path: string,
  request: NextRequest,
):
  | {
      response: {
        numFound: number;
        docs: unknown[];
      };
      facet_counts?: { facet_fields: Record<string, unknown[]> };
    }
  | unknown[]
  | null {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "data" || segments.length < 2) return null;
  const core = segments[1];
  const query = parseFixtureQuery(request);
  if (core === "taxonomy") {
    const taxonId = equalsValue(query, "taxon_id");
    const matchesKeyword = hasKeyword(query, "influenza");
    const docs =
      taxonId === "*" || taxonId === taxonomyRecord.taxon_id || matchesKeyword
        ? [taxonomyRecord]
        : [];
    if (request.headers.get("accept") === "application/json") return docs;
    return buildLoopbackSolrEnvelope(docs, {
      facetCounts: {
        facet_fields: {
          taxon_rank: ["species", docs.length],
          genetic_code: [1, docs.length],
          division: ["Viruses", docs.length],
        },
      },
    });
  }
  if (core === "serology") {
    const sampleIdentifier = equalsValue(query, "sample_identifier");
    const requestedTestType = equalsValue(query, "test_type");
    const isAmbiguous =
      sampleIdentifier === ambiguousSerologyRecords[0].sample_identifier;
    // An unmatched discriminator filters to zero rows rather than falling
    // back to the whole ambiguous set — that is what makes the "no such test
    // type" branch of the ambiguity page reachable.
    const docs = isAmbiguous
      ? requestedTestType === undefined
        ? ambiguousSerologyRecords
        : ambiguousSerologyRecords.filter(
            (fixture) => fixture.test_type === requestedTestType,
          )
      : sampleIdentifier === serologyRecord.sample_identifier ||
          hasKeyword(query, "antibody*")
        ? [serologyRecord]
        : [];
    if (request.headers.get("accept") === "application/json") return docs;
    return buildLoopbackSolrEnvelope(docs, {
      facetCounts: {
        facet_fields: {
          test_type: isAmbiguous
            ? docs.flatMap((fixture) => [fixture.test_type, 1])
            : ["ELISA/IgG test", 1],
        },
      },
    });
  }
  if (core === "experiment") {
    const experimentId = equalsValue(query, "exp_id");
    const docs =
      experimentId && experimentId !== "*"
        ? experimentId === experimentRecord.exp_id
          ? [experimentRecord]
          : []
        : [experimentRecord];
    if (request.headers.get("accept") === "application/json") return docs;
    return buildLoopbackSolrEnvelope(docs);
  }
  if (core === "protein_structure") {
    const accession = equalsValue(query, "pdb_id");
    const docs =
      accession === "*"
        ? proteinStructureRecords
        : accession
          ? proteinStructureRecords.filter(
              (record) => record.pdb_id === accession,
            )
          : proteinStructureRecords;
    if (request.headers.get("accept") === "application/json") return docs;
    return buildLoopbackSolrEnvelope(docs);
  }
  if (core === "surveillance") {
    const sampleIdentifier = equalsValue(query, "sample_identifier");
    const requestedTestType = equalsValue(query, "pathogen_test_type");
    const isAmbiguous =
      sampleIdentifier === ambiguousSurveillanceRecords[0].sample_identifier;
    const docs = isAmbiguous
      ? requestedTestType === undefined
        ? ambiguousSurveillanceRecords
        : ambiguousSurveillanceRecords.filter((fixture) =>
            fixture.pathogen_test_type.includes(requestedTestType),
          )
      : sampleIdentifier === surveillanceRecord.sample_identifier ||
          hasKeyword(query, "sentinel*")
        ? [surveillanceRecord]
        : [];
    if (request.headers.get("accept") === "application/json") return docs;
    return buildLoopbackSolrEnvelope(docs, {
      facetCounts: {
        facet_fields: {
          pathogen_test_type: isAmbiguous
            ? docs.flatMap((fixture) => [fixture.pathogen_test_type[0], 1])
            : ["RAT/antigen", 1],
        },
      },
    });
  }
  const numFound = e2eDeterministicCounts[core];
  if (typeof numFound !== "number") return null;
  const isGenomeFixtureQuery =
    core === "genome" &&
    (equalsValue(query, "genome_id") === genomeRecord.genome_id ||
      (hasKeyword(query, "MERS*") &&
        hasClause(query, "sort(+genome_name,+genome_id)")));
  const itemRange = (
    request.headers.get("range") ?? request.headers.get("x-range")
  )?.match(/^items=(\d+)-(\d+)$/i);
  const includesFixtureRow =
    !itemRange || (Number(itemRange[1]) <= 0 && Number(itemRange[2]) >= 0);
  const isEpitopeFixtureQuery =
    core === "epitope" &&
    equalsValue(query, "epitope_id") === epitopeRecord.epitope_id;
  const docs: unknown[] = includesFixtureRow
    ? isGenomeFixtureQuery
      ? [genomeRecord]
      : isEpitopeFixtureQuery
        ? [epitopeRecord]
        : []
    : [];
  if (request.headers.get("accept") === "application/json") return docs;
  return buildLoopbackSolrEnvelope(docs, { numFound });
}

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

function facetFieldFromQuery(query: FixtureQuery): string | null {
  for (const clause of query.clauses) {
    const match = /\(field,([^),=]+)\)/.exec(clause);
    if (match?.[1]) return match[1];
  }
  return null;
}

interface PivotKey {
  primary: string;
  secondary: string;
  tertiary?: string;
}

function pivotKeyFromQuery(query: FixtureQuery): PivotKey | null {
  for (const clause of query.clauses) {
    // `[^,)]+` prevents `(...,foo)),(mincount,1)` from being misread as a
    // 3-level pivot by greedily consuming the close paren of the inner pivot.
    const triple = /\(pivot,\(([^,)]+),([^,)]+),([^,)]+)\)\)/.exec(clause);
    if (triple?.[1] && triple[2] && triple[3]) {
      return { primary: triple[1], secondary: triple[2], tertiary: triple[3] };
    }
    const match = /\(pivot,\(([^,)]+),([^,)]+)\)\)/.exec(clause);
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

  // Both landing-page endpoints are table lookups keyed by taxon id, so
  // "which taxa this mock knows" is one fact in
  // src/lib/e2e-fixtures/records.ts rather than a branch per taxon here.
  const summaryTaxonId = endpoint.match(
    /^data\/summary_by_taxon\/(\d+)\/?$/,
  )?.[1];
  if (summaryTaxonId) {
    const summary = findOrganismSummaryRecord(summaryTaxonId);
    if (summary) return { kind: "ok", body: summary };
  }

  const websiteTaxonId = endpoint.match(/^taxonomy\/(\d+)\/?$/)?.[1];
  if (websiteTaxonId) {
    const taxon = findOrganismTaxonomyRecord(websiteTaxonId);
    if (taxon) return { kind: "ok", body: taxon };
  }
  if (endpoint === "genome" || endpoint === "genome/") {
    const query = parseFixtureQuery(request);

    // Reference-genomes endpoint: BV-BRC returns a bare array of docs
    // (json(nl,map)), not the SOLR envelope shape.
    if (
      equalsValue(query, "reference_genome") === "*" &&
      hasCall(query, "select")
    ) {
      return { kind: "ok", body: referenceGenomesFixture };
    }

    // Parsed equality, not a substring: a fixture taxon "234" must not match
    // a request for taxon "1234".
    const rawTaxonId = equalsValue(query, "taxon_lineage_ids");
    const taxonId = /^\d+$/.test(rawTaxonId ?? "") ? Number(rawTaxonId) : null;

    const pivot = pivotKeyFromQuery(query);
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
    const field = facetFieldFromQuery(query);
    if (!field) {
      return { kind: "unhandled", reason: "no pivot or facet field" };
    }
    let count = bacteriaSummaryRecord.count;
    if (taxonId === 10239) count = virusesSummaryRecord.count;
    else if (taxonId === 131567) count = allOrganismsSummaryRecord.count;
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

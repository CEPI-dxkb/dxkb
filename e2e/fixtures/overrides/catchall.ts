import type { JsonOverride } from "../../mocks/backends";
import {
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
  biosetRecord,
  epitopeAssayRecords,
  epitopeRecord,
  experimentRecord,
  genomeFeatureRecord,
  genomeRecord,
  genomeSequenceRecord,
  proteinFeatureRecord,
  proteinStructureRecords,
  serologyRecord,
  strainRecords,
  surveillanceRecord,
  taxonomyRecord,
} from "@/lib/e2e-fixtures/records";
import { compareRegionScenarioOverrides } from "./compare-region";
import { genomeBrowserScenarioOverrides } from "./genome-browser";
import {
  buildBrowserRpcSuccess,
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackSolrEnvelope,
} from "@/lib/e2e-fixtures/envelopes";

/**
 * Browser-side mocks built from the canonical records in
 * `src/lib/e2e-fixtures/records.ts`, shared with the server-side loopback.
 * Specs import the named bundle they exercise; the only broad aggregate is
 * `a11yBackendOverrides`.
 */
const genomeRows = [genomeRecord];

const genomeFeatureRows = [genomeFeatureRecord];

const proteinFeatureRows = [proteinFeatureRecord];

const minimalPdb = [
  "HEADER    E2E PROTEIN STRUCTURE",
  "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N  ",
  "TER",
  "END",
  "",
].join("\n");

const minimalCif = [
  "data_E2E",
  "_entry.id E2E",
  "loop_",
  "_atom_site.group_PDB",
  "_atom_site.id",
  "_atom_site.type_symbol",
  "_atom_site.label_atom_id",
  "_atom_site.label_comp_id",
  "_atom_site.label_asym_id",
  "_atom_site.label_seq_id",
  "_atom_site.Cartn_x",
  "_atom_site.Cartn_y",
  "_atom_site.Cartn_z",
  "ATOM 1 N N ALA A 1 0.000 0.000 0.000",
  "#",
  "",
].join("\n");

const proteinStructureRows = proteinStructureRecords;

const epitopeRows = [epitopeRecord];

const epitopeAssayRows = epitopeAssayRecords;

const experimentRows = [experimentRecord];

const biosetRows = [biosetRecord];

const strainRows = strainRecords;

const surveillanceRows = [surveillanceRecord, ...ambiguousSurveillanceRecords];

const serologyRows = [serologyRecord, ...ambiguousSerologyRecords];

const taxonomyRows = [taxonomyRecord];

function genomeDataResponse({ parsedBody }: { parsedBody: unknown }) {
  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    "operation" in parsedBody &&
    (parsedBody.operation === "selected" || parsedBody.operation === "export")
  ) {
    return buildGatewayRowsEnvelope(genomeRows);
  }
  return buildGatewayCollectionEnvelope(genomeRows);
}

export const emptyBackendFallbackOverrides: JsonOverride[] = [
  { url: /\/api\/auth\//, method: "GET", body: {} },
  { url: /\/api\/auth\//, method: "POST", body: {} },
  { url: /\/api\/services\//, method: "GET", body: {} },
  {
    url: /\/api\/services\//,
    method: "POST",
    body: buildBrowserRpcSuccess([[]]),
  },
  { url: /\/api\/workspace\//, method: "GET", body: { items: [] } },
  { url: /\/api\/workspace\//, method: "POST", body: {} },
];

/**
 * Data-free `/api/taxonomy-tree/*` bundle for specs that mount the tree
 * incidentally. A spec exercising the tree must supply its own entries first,
 * since an empty `{rows}` earlier in the list wins and leaves every node a
 * leaf.
 */
export const taxonomyTreeScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/taxonomy-tree\/children(?:\?|$)/,
    method: "GET",
    body: { rows: [] },
  },
  {
    url: /\/api\/taxonomy-tree\/child-counts(?:\?|$)/,
    method: "GET",
    body: { counts: {} },
  },
];

export const taxonomyScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/taxonomy(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(taxonomyRows, {
      facets: {
        taxon_rank: [{ value: "species", count: 1 }],
        genetic_code: [{ value: 1, count: 1 }],
        division: [{ value: "Viruses", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/taxonomy(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(taxonomyRows),
  },
];

export const experimentScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/e2e-mock\/data\/experiment\/(?:\?|$)/,
    method: "GET",
    body: buildLoopbackSolrEnvelope(experimentRows),
  },
  {
    url: /\/api\/data\/experiment(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(experimentRows, {
      facets: {
        exp_type: [{ value: "Transcript Quantification", count: 1 }],
        measurement_technique: [{ value: "RNA-Seq", count: 1 }],
        organism: [
          {
            value: "Middle East respiratory syndrome-related coronavirus",
            count: 1,
          },
        ],
      },
    }),
  },
  {
    url: /\/api\/data\/experiment(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(experimentRows),
  },
];

export const biosetScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/bioset(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(biosetRows, {
      facets: {
        bioset_type: [
          { value: "Differential Expression", count: 1 },
        ],
        organism: [
          {
            value: "Middle East respiratory syndrome-related coronavirus",
            count: 1,
          },
        ],
      },
    }),
  },
  {
    url: /\/api\/data\/bioset(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(biosetRows),
  },
];

export const proteinStructureScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/structure\/PDB\/(?:6VXX|7BV2)\.pdb$/,
    method: "GET",
    headers: { "Content-Type": "chemical/x-pdb" },
    body: minimalPdb,
  },
  {
    url: /\/api\/data\/protein_structure(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(proteinStructureRows, {
      facets: {
        method: [{ value: "Electron microscopy", count: 2 }],
        institution: [{ value: "University of Texas at Austin", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/protein_structure(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(proteinStructureRows),
  },
];

export const proteinFeatureScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/protein_feature(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(proteinFeatureRows, {
      facets: {
        feature_type: [{ value: "Domain", count: 1 }],
        source: [{ value: "InterPro", count: 1 }],
        classification: [{ value: "Conserved domain", count: 1 }],
        evidence: [{ value: "HMM", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/protein_feature(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(proteinFeatureRows),
  },
];

export const strainScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/e2e-mock\/data\/strain\/(?:\?|$)/,
    method: "GET",
    body: buildLoopbackSolrEnvelope(strainRows, {
      facetCounts: {
        facet_fields: {
          subtype: ["H1N1", 2],
          status: ["Complete", 1, "Partial", 1],
          isolation_country: ["United States", 1],
          collection_year: [2009, 1],
        },
      },
    }),
  },
  {
    url: /\/api\/data\/strain(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(strainRows, {
      facets: {
        subtype: [{ value: "H1N1", count: 2 }],
        status: [
          { value: "Complete", count: 1 },
          { value: "Partial", count: 1 },
        ],
        isolation_country: [{ value: "United States", count: 1 }],
        collection_year: [{ value: 2009, count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/strain(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(strainRows),
  },
];

/**
 * Both strain records share the name `A/California/04/2009`, so only their
 * record IDs tell the result links apart.
 */
export const strainAllTypesSearchOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/search$/,
    method: "POST",
    body: {
      strain: {
        result: {
          response: { docs: strainRows, numFound: strainRows.length },
        },
      },
    },
  },
];

export const serologyScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/e2e-mock\/data\/serology\/(?:\?|$)/,
    method: "GET",
    body: buildLoopbackSolrEnvelope(serologyRows, {
      facetCounts: {
        facet_fields: {
          host_type: ["Human", 1],
          collection_country: ["Australia", 1],
          test_type: ["ELISA/IgG test", 1],
          test_result: ["Detected", 1],
        },
      },
    }),
  },
  {
    url: /\/api\/data\/serology(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(serologyRows.slice(0, 1), {
      facets: {
        host_type: [{ value: "Human", count: 1 }],
        collection_country: [{ value: "Australia", count: 1 }],
        test_type: [{ value: "ELISA/IgG test", count: 1 }],
        test_result: [{ value: "Detected", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/serology(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(serologyRows.slice(0, 1)),
  },
];

export const surveillanceScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/e2e-mock\/data\/surveillance\/(?:\?|$)/,
    method: "GET",
    body: buildLoopbackSolrEnvelope(surveillanceRows, {
      facetCounts: {
        facet_fields: {
          collection_year: [2024, 1],
          collection_country: ["Australia", 1],
          pathogen_test_type: ["RAT/antigen", 1],
          pathogen_test_result: ["Positive", 1],
        },
      },
    }),
  },
  {
    url: /\/api\/data\/surveillance(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(surveillanceRows.slice(0, 1), {
      facets: {
        collection_year: [{ value: 2024, count: 1 }],
        collection_country: [{ value: "Australia", count: 1 }],
        pathogen_test_type: [{ value: "RAT/antigen", count: 1 }],
        pathogen_test_result: [{ value: "Positive", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/surveillance(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(surveillanceRows.slice(0, 1)),
  },
];

export const epitopeAssayScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/epitope_assay(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(epitopeAssayRows, {
      total: 2,
    }),
  },
  {
    url: /\/api\/data\/epitope_assay(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(epitopeAssayRows),
  },
];

export const epitopeScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/epitope(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(epitopeRows, {
      facets: {
        epitope_type: [{ value: "Discontinuous peptide", count: 1 }],
        protein_name: [{ value: "Hemagglutinin", count: 1 }],
        host_name: [{ value: "Human", count: 1 }],
        assay_results: [{ value: "Positive", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/epitope(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(epitopeRows),
  },
];

export const genomeFeatureScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/genome_feature(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(genomeFeatureRows, {
      facets: {
        annotation: [{ value: "PATRIC", count: 1 }],
        feature_type: [{ value: "CDS", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/genome_feature(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope(genomeFeatureRows),
  },
];

export const genomeSequenceScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/genome_sequence(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope([genomeSequenceRecord]),
  },
  {
    url: /\/api\/data\/genome_sequence(?:\?|$)/,
    method: "POST",
    body: buildGatewayRowsEnvelope([genomeSequenceRecord]),
  },
];

export const genomeScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/genome(?:\?|$)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope(genomeRows, {
      facets: {
        genome_status: [{ value: "Complete", count: 1 }],
        genome_quality: [{ value: "Good", count: 1 }],
      },
    }),
  },
  {
    url: /\/api\/data\/genome(?:\?|$)/,
    method: "POST",
    body: genomeDataResponse,
  },
];

/**
 * Rows only; the tab's `facet=` request falls through to
 * `genomeScenarioOverrides`.
 */
export const taxonGenomesScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/data\/genome(?=\?)(?=[^#]*[?&]operation=collection(?:&|$))(?=[^#]*taxon_lineage_ids%2C11974%29)(?![^#]*[?&]facet=)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope([
      genomeRecord,
      {
        ...genomeRecord,
        genome_id: "11983.1",
        genome_name: "Norwalk virus isolate Hu/NLV/1968",
        strain: "Hu/NLV/1968",
        genome_length: 7_654,
        cds: 3,
        collection_year: 1968,
        isolation_country: "USA",
        genbank_accessions: ["M87661"],
        taxon_id: 11983,
        taxon_lineage_ids: [10239, 11974, 11983],
        taxon_lineage_names: ["Viruses", "Caliciviridae", "Norwalk virus"],
      },
    ]),
  },
];

const namedResourceScenarioOverrides: JsonOverride[] = [
  ...taxonomyTreeScenarioOverrides,
  ...taxonomyScenarioOverrides,
  ...experimentScenarioOverrides,
  ...biosetScenarioOverrides,
  ...proteinStructureScenarioOverrides,
  ...proteinFeatureScenarioOverrides,
  ...strainScenarioOverrides,
  ...serologyScenarioOverrides,
  ...surveillanceScenarioOverrides,
  ...epitopeAssayScenarioOverrides,
  ...epitopeScenarioOverrides,
  // Must precede the genome-feature bundle, whose `/api/data/genome_feature`
  // GET would otherwise answer the Compare Region member read with a list
  // (first match wins).
  ...compareRegionScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...genomeSequenceScenarioOverrides,
  ...genomeBrowserScenarioOverrides,
  ...genomeScenarioOverrides,
];

const apiCatchallOverrides: JsonOverride[] = [
  ...namedResourceScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

/**
 * Anchored to scheme + host: an unanchored `/patricbrc\.org/` would match
 * `http://127.0.0.1:3020/workspace/user@patricbrc.org/home` and hijack
 * navigation.
 */
const externalCatchallOverrides: JsonOverride[] = [
  {
    url: /^https:\/\/alphafold\.ebi\.ac\.uk\/files\/AF-P12345-F1-model_v6\.cif$/i,
    headers: { "Content-Type": "chemical/x-mmcif" },
    body: minimalCif,
  },
  {
    url: /^https:\/\/files\.rcsb\.org\/download\/(?:6VXX|7BV2)\.cif$/i,
    headers: { "Content-Type": "chemical/x-mmcif" },
    body: minimalCif,
  },
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*patricbrc\.org(?:[:/]|$)/i, body: {} },
  { url: /^https?:\/\/(?:[a-z0-9-]+\.)*bv-brc\.org(?:[:/]|$)/i, body: {} },
  {
    url: /^https?:\/\/(?:[a-z0-9-]+\.)*theseed\.org(?:[:/]|$)/i,
    body: buildBrowserRpcSuccess([[]]),
  },
  {
    url: /^https?:\/\/(?:[a-z0-9-]+\.)*ncbi\.nlm\.nih\.gov(?:[:/]|$)/i,
    body: {},
  },
];

/**
 * Reserved for the accessibility sweep (`e2e/tests/a11y/`); other specs
 * import the specific named bundles.
 */
export const a11yBackendOverrides: JsonOverride[] = [
  ...apiCatchallOverrides,
  ...externalCatchallOverrides,
];

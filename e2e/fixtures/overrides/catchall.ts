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
import {
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackSolrEnvelope,
} from "@/lib/e2e-fixtures/envelopes";

/**
 * Browser-side mocks for API namespaces that don't have specific fixtures,
 * built from the canonical records in `src/lib/e2e-fixtures/records.ts` — the
 * same records the server-side loopback mock (`src/app/api/e2e-mock/[...path]/route.ts`)
 * uses. A record fixed once (e.g. the epitope `host_name` drift) is now correct
 * in both transports.
 *
 * This module is intentionally split into two kinds of exports:
 *
 *   - `emptyBackendFallbackOverrides` — generic, data-free responses for
 *     namespaces every page touches (auth, services, workspace) plus external
 *     hosts. Safe to include anywhere; answers with `{}` / `[]`, never with
 *     named business data a test didn't ask for.
 *   - Per-resource NAMED scenario bundles (`genomeScenarioOverrides`,
 *     `epitopeScenarioOverrides`, etc.) — populated fixture data for one
 *     resource. Import the ones a spec actually exercises instead of reaching
 *     for the broad aggregate below. `taxonomyTreeScenarioOverrides` is the one
 *     bundle named for a *boundary* rather than a resource, because the Taxa
 *     Tree has its own route rather than an `/api/data` operation.
 *
 * `apiCatchallOverrides` composes the named bundles + the empty fallback (no
 * external hosts) as an internal building block. `a11yBackendOverrides` adds
 * `externalCatchallOverrides` on top and is the *only* broad, unscoped
 * aggregate this module exports — reserved for the accessibility sweep (see
 * its doc comment below). Every journey/view/smoke spec in the suite has been
 * converted to import the specific named bundle(s) it actually exercises;
 * there is no `permissiveBackendOverrides` fallback anymore.
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

/** Generic, data-free responses — safe as a blanket fallback for any test. */
export const emptyBackendFallbackOverrides: JsonOverride[] = [
  { url: /\/api\/auth\//, method: "GET", body: {} },
  { url: /\/api\/auth\//, method: "POST", body: {} },
  { url: /\/api\/services\//, method: "GET", body: {} },
  { url: /\/api\/services\//, method: "POST", body: { result: [[]] } },
  { url: /\/api\/workspace\//, method: "GET", body: { items: [] } },
  { url: /\/api\/workspace\//, method: "POST", body: {} },
];

/**
 * The Taxa Tree's own same-origin boundary (`/api/taxonomy-tree/*`), which is
 * not the `/api/data/taxonomy` gateway below: the tree has a dedicated route
 * because it asks for one node's children in a single upstream range far
 * wider than the gateway's fixed 200-row page, and reads its child counts from
 * a `facet_counts` response header (`src/lib/data-api/taxonomy-tree.ts`).
 *
 * Data-free on purpose — an empty `{rows}` and an empty `{counts}`, so a page
 * that mounts the tree renders its server-provided root rows with no children
 * and no expand arrows. This is the bundle for a spec that mounts the tree
 * incidentally and only needs the strict guard satisfied: `applyBackendMocks`'
 * guard aborts any unmocked `/api/**` request and fails the test on teardown.
 * `e2e/tests/organisms/all.spec.ts` and the a11y sweep use it that way.
 *
 * A spec that exercises the tree itself does not use this bundle at all — it
 * supplies its own content-bearing entries for both operations, because an
 * empty `{rows}`/`{counts}` earlier in the list would win under first-match
 * ordering and leave every node a leaf. `e2e/tests/taxonomy-tree.spec.ts` is
 * the worked example.
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
          { value: "Transcriptomics Differential Expression", count: 1 },
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
 * Union of every named resource scenario bundle above. Internal composition
 * building block only — not exported. No spec should import "every resource
 * bundle at once"; a spec that needs broad coverage across many resource
 * types is the accessibility sweep's job (`a11yBackendOverrides` below), not
 * a general-purpose escape hatch for other specs.
 */
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
  ...genomeFeatureScenarioOverrides,
  ...genomeSequenceScenarioOverrides,
  ...genomeScenarioOverrides,
];

/** Internal composition building block only — not exported (see above). */
const apiCatchallOverrides: JsonOverride[] = [
  ...namedResourceScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

/**
 * External-host stubs — an `a11yBackendOverrides` building block only, not
 * exported. No journey spec needs one: the last importer was
 * `e2e/tests/organisms/all.spec.ts`, whose only external dependency was the
 * Taxa Tree reading `NEXT_PUBLIC_DATA_API` straight from the browser, which it
 * no longer does.
 *
 * Anchored to scheme + host so these only match outbound requests whose HOST
 * ends in one of the domains. Without the anchor, a URL like
 * `http://127.0.0.1:3020/workspace/user@patricbrc.org/home` would match
 * `/patricbrc\.org/` and hijack the page navigation itself.
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
    body: { result: [[]] },
  },
  {
    url: /^https?:\/\/(?:[a-z0-9-]+\.)*ncbi\.nlm\.nih\.gov(?:[:/]|$)/i,
    body: {},
  },
];

/**
 * The one broad, unscoped aggregate — reserved for the accessibility sweep
 * (`e2e/tests/a11y/*.spec.ts`). Those specs scan dozens of routes spanning
 * every resource type in one pass, so they legitimately need every named
 * scenario bundle populated at once, unlike a single-resource journey or
 * smoke spec, which should import the specific named bundle(s) it exercises
 * instead. Do not import this outside `e2e/tests/a11y/` — every other spec in
 * the suite has been converted to declare its actual fixture dependency (see
 * `e2e/README.md`'s "Canonical fixture records" section). There is no
 * `permissiveBackendOverrides` alias anymore; this is the only broad export.
 */
export const a11yBackendOverrides: JsonOverride[] = [
  ...apiCatchallOverrides,
  ...externalCatchallOverrides,
];

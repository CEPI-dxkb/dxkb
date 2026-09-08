import type { JsonOverride } from "../../mocks/backends";

/**
 * Permissive catch-all mocks for API namespaces that don't have specific fixtures.
 * These apply at the END of any override list (matched first by route LIFO) so more
 * specific overrides registered later override them. Use to keep strict mode happy
 * without explicitly mocking every endpoint a page touches.
 */
const genomeSequenceRows = [
  {
    sequence_id: "1282460.2049.con.0001",
    genome_id: "1282460.2049",
    accession: "JX869059",
    length: 30_119,
  },
];

const genomeFeatureRows = [
  {
    feature_id: "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
    patric_id: "fig|1282460.2049.peg.1",
    genome_id: "1282460.2049",
    genome_name: "Middle East respiratory syndrome-related coronavirus isolate",
    taxon_id: 1335626,
    annotation: "PATRIC",
    feature_type: "CDS",
    accession: "JX869059",
    start: 1,
    end: 100,
    strand: "+",
    product: "replicase polyprotein",
    aa_length: 33,
  },
];

const proteinFeatureRows = [
  {
    id: "protein-feature-backend-901",
    genome_id: "1282460.2049",
    genome_name: "Middle East respiratory syndrome-related coronavirus isolate",
    taxon_id: 1335626,
    feature_id: "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
    patric_id: "fig|1282460.2049.peg.1",
    refseq_locus_tag: "YP_009047204.1",
    gene: "ORF1ab",
    product: "replicase polyprotein",
    interpro_id: "IPR043607",
    interpro_description: "Coronavirus replicase domain",
    feature_type: "Domain",
    source: "InterPro",
    source_id: "cd21589",
    description: "RNA-directed RNA polymerase domain",
    classification: "Conserved domain",
    e_value: "1E-20",
    evidence: "HMM",
    date_inserted: "2024-01-01",
  },
];

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

const proteinStructureRows = [
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

const epitopeRows = [
  {
    epitope_id: "15780",
    epitope_type: "Discontinuous peptide",
    epitope_sequence: "A1, C4, D8",
    organism: "Influenza A virus",
    taxon_id: 11520,
    taxon_lineage_ids: [10239, 11520],
    protein_name: "Hemagglutinin",
    protein_accession: "P03452",
    host_name: ["Homo sapiens, human"],
    total_assays: 2,
    assay_results: ["Positive", "Negative"],
    bcell_assays: 2,
    tcell_assays: 0,
    mhc_assays: 0,
    comments: "Discontinuous residues",
    date_inserted: "2024-01-01",
  },
];

const epitopeAssayRows = [
  {
    assay_id: "A-1",
    epitope_id: "15780",
    assay_type: "B cell",
    assay_method: "ELISA",
    assay_group: "Antibody",
    assay_result: "Positive",
    host_name: "Human",
    pmid: "123456",
    title: "Influenza epitope assay",
    protein_name: "Hemagglutinin",
    epitope_type: "Discontinuous peptide",
  },
  {
    assay_id: "A-2",
    epitope_id: "15780",
    assay_type: "B cell",
    assay_method: "Neutralization",
    assay_group: "Antibody",
    assay_result: "Negative",
    host_name: "Human",
    pmid: "123456",
    title: "Influenza epitope assay",
    protein_name: "Hemagglutinin",
    epitope_type: "Discontinuous peptide",
  },
];

const experimentRows = [
  {
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
  },
];

const biosetRows = [
  {
    bioset_id: "B-2000000-1",
    exp_id: "2000000",
    study_name: "E2E host response study",
    exp_name: "E2E-RNA-1",
    exp_title: "RNA response experiment",
    exp_type: "Transcript Quantification",
    bioset_name: "Infected versus mock",
    bioset_description: "Differentially expressed genes.",
    bioset_type: "Transcriptomics Differential Expression",
    bioset_criteria: "absolute fold change > 1.5",
    organism: "Middle East respiratory syndrome-related coronavirus",
    strain: "E2E strain",
    entity_count: 88,
    date_inserted: "2024-01-01",
  },
];

const strainRows = [
  {
    id: "strain-backend-901",
    taxon_id: 11520,
    taxon_lineage_ids: [10239, 11520],
    family: "Orthomyxoviridae",
    genus: "Alphainfluenzavirus",
    species: "Influenza A virus",
    strain: "A/California/04/2009",
    subtype: "H1N1",
    genome_ids: ["641501.3", "641501.4"],
    genbank_accessions: ["FJ969513", "FJ969514"],
    segment_count: 8,
    status: "Complete",
    host_common_name: "Human",
    isolation_country: "United States",
    collection_date: "2009-04",
    collection_year: 2009,
    "1_pb2": ["FJ969513"],
    "4_ha": ["FJ969516"],
  },
  {
    id: "strain-backend-902",
    taxon_id: 11520,
    taxon_lineage_ids: [10239, 11520],
    species: "Influenza A virus",
    strain: "A/California/04/2009",
    subtype: "H1N1",
    genome_ids: ["641501.5"],
    genbank_accessions: ["FJ969515"],
    segment_count: 8,
    status: "Partial",
  },
];

const surveillanceRows = [
  {
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
  },
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

const serologyRows = [
  {
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
  },
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

const genomeRows = [
  {
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
  },
];

function genomeDataResponse({ parsedBody }: { parsedBody: unknown }) {
  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    "operation" in parsedBody &&
    (parsedBody.operation === "selected" || parsedBody.operation === "export")
  ) {
    return { rows: genomeRows };
  }
  return { rows: genomeRows, total: 1, facets: {}, page: 1, pageSize: 200 };
}

export const apiCatchallOverrides: JsonOverride[] = [
  {
    url: /\/api\/e2e-mock\/data\/experiment\/(?:\?|$)/,
    method: "GET",
    body: {
      response: { numFound: experimentRows.length, docs: experimentRows },
    },
  },
  {
    url: /\/api\/data\/bioset(?:\?|$)/,
    method: "GET",
    body: {
      rows: biosetRows,
      total: biosetRows.length,
      facets: {
        bioset_type: [{ value: "Transcriptomics Differential Expression", count: 1 }],
        organism: [{ value: "Middle East respiratory syndrome-related coronavirus", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/bioset(?:\?|$)/,
    method: "POST",
    body: { rows: biosetRows },
  },
  {
    url: /\/api\/data\/experiment(?:\?|$)/,
    method: "GET",
    body: {
      rows: experimentRows,
      total: experimentRows.length,
      facets: {
        exp_type: [{ value: "Transcript Quantification", count: 1 }],
        measurement_technique: [{ value: "RNA-Seq", count: 1 }],
        organism: [{ value: "Middle East respiratory syndrome-related coronavirus", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/experiment(?:\?|$)/,
    method: "POST",
    body: { rows: experimentRows },
  },
  {
    url: /\/api\/structure\/PDB\/(?:6VXX|7BV2)\.pdb$/,
    method: "GET",
    headers: { "Content-Type": "chemical/x-pdb" },
    body: minimalPdb,
  },
  {
    url: /\/api\/data\/protein_structure(?:\?|$)/,
    method: "GET",
    body: {
      rows: proteinStructureRows,
      total: proteinStructureRows.length,
      facets: {
        method: [{ value: "Electron microscopy", count: 2 }],
        institution: [{ value: "University of Texas at Austin", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/protein_structure(?:\?|$)/,
    method: "POST",
    body: { rows: proteinStructureRows },
  },
  {
    url: /\/api\/data\/protein_feature(?:\?|$)/,
    method: "GET",
    body: {
      rows: proteinFeatureRows,
      total: proteinFeatureRows.length,
      facets: {
        feature_type: [{ value: "Domain", count: 1 }],
        source: [{ value: "InterPro", count: 1 }],
        classification: [{ value: "Conserved domain", count: 1 }],
        evidence: [{ value: "HMM", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/protein_feature(?:\?|$)/,
    method: "POST",
    body: { rows: proteinFeatureRows },
  },
  {
    url: /\/api\/e2e-mock\/data\/strain\/(?:\?|$)/,
    method: "GET",
    body: {
      response: { numFound: strainRows.length, docs: strainRows },
      facet_counts: {
        facet_fields: {
          subtype: ["H1N1", 2],
          status: ["Complete", 1, "Partial", 1],
          isolation_country: ["United States", 1],
          collection_year: [2009, 1],
        },
      },
    },
  },
  {
    url: /\/api\/data\/strain(?:\?|$)/,
    method: "GET",
    body: {
      rows: strainRows,
      total: strainRows.length,
      facets: {
        subtype: [{ value: "H1N1", count: 2 }],
        status: [
          { value: "Complete", count: 1 },
          { value: "Partial", count: 1 },
        ],
        isolation_country: [{ value: "United States", count: 1 }],
        collection_year: [{ value: 2009, count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/strain(?:\?|$)/,
    method: "POST",
    body: { rows: strainRows },
  },
  {
    url: /\/api\/e2e-mock\/data\/serology\/(?:\?|$)/,
    method: "GET",
    body: {
      response: { numFound: serologyRows.length, docs: serologyRows },
      facet_counts: {
        facet_fields: {
          host_type: ["Human", 1],
          collection_country: ["Australia", 1],
          test_type: ["ELISA/IgG test", 1],
          test_result: ["Detected", 1],
        },
      },
    },
  },
  {
    url: /\/api\/data\/serology(?:\?|$)/,
    method: "GET",
    body: {
      rows: serologyRows.slice(0, 1),
      total: 1,
      facets: {
        host_type: [{ value: "Human", count: 1 }],
        collection_country: [{ value: "Australia", count: 1 }],
        test_type: [{ value: "ELISA/IgG test", count: 1 }],
        test_result: [{ value: "Detected", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/serology(?:\?|$)/,
    method: "POST",
    body: { rows: serologyRows.slice(0, 1) },
  },
  {
    url: /\/api\/e2e-mock\/data\/surveillance\/(?:\?|$)/,
    method: "GET",
    body: {
      response: { numFound: surveillanceRows.length, docs: surveillanceRows },
      facet_counts: {
        facet_fields: {
          collection_year: [2024, 1],
          collection_country: ["Australia", 1],
          pathogen_test_type: ["RAT/antigen", 1],
          pathogen_test_result: ["Positive", 1],
        },
      },
    },
  },
  {
    url: /\/api\/data\/surveillance(?:\?|$)/,
    method: "GET",
    body: {
      rows: surveillanceRows.slice(0, 1),
      total: 1,
      facets: {
        collection_year: [{ value: 2024, count: 1 }],
        collection_country: [{ value: "Australia", count: 1 }],
        pathogen_test_type: [{ value: "RAT/antigen", count: 1 }],
        pathogen_test_result: [{ value: "Positive", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/surveillance(?:\?|$)/,
    method: "POST",
    body: { rows: surveillanceRows.slice(0, 1) },
  },
  {
    url: /\/api\/data\/epitope_assay(?:\?|$)/,
    method: "GET",
    body: {
      rows: epitopeAssayRows,
      total: 2,
      facets: {},
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/epitope_assay(?:\?|$)/,
    method: "POST",
    body: { rows: epitopeAssayRows },
  },
  {
    url: /\/api\/data\/epitope(?:\?|$)/,
    method: "GET",
    body: {
      rows: epitopeRows,
      total: 1,
      facets: {
        epitope_type: [{ value: "Discontinuous peptide", count: 1 }],
        protein_name: [{ value: "Hemagglutinin", count: 1 }],
        host_name: [{ value: "Human", count: 1 }],
        assay_results: [{ value: "Positive", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/epitope(?:\?|$)/,
    method: "POST",
    body: { rows: epitopeRows },
  },
  {
    url: /\/api\/data\/genome_feature(?:\?|$)/,
    method: "GET",
    body: {
      rows: genomeFeatureRows,
      total: 1,
      facets: {
        annotation: [{ value: "PATRIC", count: 1 }],
        feature_type: [{ value: "CDS", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/genome_feature(?:\?|$)/,
    method: "POST",
    body: { rows: genomeFeatureRows },
  },
  {
    url: /\/api\/data\/genome_sequence(?:\?|$)/,
    method: "GET",
    body: {
      rows: genomeSequenceRows,
      total: 1,
      facets: {},
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/genome_sequence(?:\?|$)/,
    method: "POST",
    body: { rows: genomeSequenceRows },
  },
  {
    url: /\/api\/data\/genome(?:\?|$)/,
    method: "GET",
    body: {
      rows: genomeRows,
      total: 1,
      facets: {
        genome_status: [{ value: "Complete", count: 1 }],
        genome_quality: [{ value: "Good", count: 1 }],
      },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/genome(?:\?|$)/,
    method: "POST",
    body: genomeDataResponse,
  },
  { url: /\/api\/auth\//, method: "GET", body: {} },
  { url: /\/api\/auth\//, method: "POST", body: {} },
  { url: /\/api\/services\//, method: "GET", body: {} },
  { url: /\/api\/services\//, method: "POST", body: { result: [[]] } },
  { url: /\/api\/workspace\//, method: "GET", body: { items: [] } },
  { url: /\/api\/workspace\//, method: "POST", body: {} },
];

// Anchor to scheme + host so these only match outbound requests whose HOST ends in one of the
// domains. Without the anchor, a URL like `http://127.0.0.1:3020/workspace/user@patricbrc.org/home`
// would match `/patricbrc\.org/` and hijack the page navigation itself.
export const externalCatchallOverrides: JsonOverride[] = [
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

/** Combined catch-all for the quick "I just want the page to render" case. */
export const permissiveBackendOverrides: JsonOverride[] = [
  ...apiCatchallOverrides,
  ...externalCatchallOverrides,
];

/**
 * Canonical E2E fixture records — the single source of truth for deterministic
 * domain data used by the mock transport layers:
 *
 *   - Browser-side:  e2e/fixtures/overrides/* (via `applyBackendMocks`)
 *   - Server-side:   src/app/api/e2e-mock/[...path]/route.ts (loopback mock)
 *
 * Most records are shared by both, which is the point. A few are reached
 * through one transport only — the BV-BRC *website* tables below are
 * server-rendered, the PPI rows are browser-fetched — and they live here
 * anyway so "what a fixture of this kind looks like" stays one fact, and so
 * the schema and cross-table checks in `__tests__/records.test.ts` cover them
 * too. Each record's own comment names the endpoint it answers.
 *
 * Both layers are required because Playwright's `page.route()` cannot see
 * server-side fetches (Server Components, route handlers forwarding to
 * backend URLs rewritten by `.env.e2e.test`). Before this module existed, each
 * layer hand-rolled its own copy of these records and they drifted (e.g.
 * epitope `host_name` was an array in one file and a string in the other).
 *
 * Deliberately dependency-free: no imports from `src/` app code, no zod, no
 * envelope/transport fields. Plain typed data only, so it can be parsed
 * directly by the production Zod schemas in `src/lib/data-api/schemas.ts`
 * (see `src/lib/e2e-fixtures/__tests__/records.test.ts`) and wrapped by
 * `src/lib/e2e-fixtures/envelopes.ts` for each transport.
 */

export interface TaxonomyFixtureRecord {
  taxon_id: string;
  taxon_name: string;
  taxon_rank: string;
  other_names: string[];
  genetic_code: number;
  lineage_ids: string[];
  lineage_names: string[];
  parent_id: string;
  division: string;
  description: string;
  genomes: number;
}

export const taxonomyRecord: TaxonomyFixtureRecord = {
  taxon_id: "11520",
  taxon_name: "Influenza A virus",
  taxon_rank: "species",
  other_names: ["Influenza A"],
  genetic_code: 1,
  lineage_ids: ["10239", "11308", "11520"],
  lineage_names: ["Viruses", "Orthornavirae", "Influenza A virus"],
  parent_id: "11320",
  division: "Viruses",
  description: "Influenza A virus taxonomy record",
  genomes: 42,
};

export interface GenomeFixtureRecord {
  genome_id: string;
  genome_name: string;
  strain: string;
  superkingdom: string;
  genome_status: string;
  genome_quality: string;
  genome_length: number;
  contigs: number;
  cds: number;
  collection_year: number;
  isolation_country: string;
  host_common_name: string;
  genbank_accessions: string[];
  taxon_id: number;
  taxon_lineage_ids: number[];
  taxon_lineage_names: string[];
}

export const genomeRecord: GenomeFixtureRecord = {
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

export interface GenomeFeatureFixtureRecord {
  feature_id: string;
  patric_id: string;
  genome_id: string;
  genome_name: string;
  taxon_id: number;
  annotation: string;
  feature_type: string;
  accession: string;
  start: number;
  end: number;
  strand: string;
  product: string;
  aa_length: number;
}

export const genomeFeatureRecord: GenomeFeatureFixtureRecord = {
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
};

export interface GenomeSequenceFixtureRecord {
  sequence_id: string;
  genome_id: string;
  accession: string;
  length: number;
}

export const genomeSequenceRecord: GenomeSequenceFixtureRecord = {
  sequence_id: "1282460.2049.con.0001",
  genome_id: "1282460.2049",
  accession: "JX869059",
  length: 30_119,
};

export interface ProteinFeatureFixtureRecord {
  id: string;
  genome_id: string;
  genome_name: string;
  taxon_id: number;
  feature_id: string;
  patric_id: string;
  refseq_locus_tag: string;
  gene: string;
  product: string;
  interpro_id: string;
  interpro_description: string;
  feature_type: string;
  source: string;
  source_id: string;
  description: string;
  classification: string;
  e_value: string;
  evidence: string;
  date_inserted: string;
}

export const proteinFeatureRecord: ProteinFeatureFixtureRecord = {
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
};

export interface ProteinStructureFixtureRecord {
  pdb_id: string;
  title: string;
  organism_name: string;
  taxon_id: number;
  taxon_lineage_ids?: number[];
  taxon_lineage_names?: string[];
  genome_id?: string;
  patric_id?: string;
  uniprotkb_accession?: string[];
  gene?: string;
  product?: string;
  sequence_md5?: string;
  method: string;
  resolution: number;
  pmid?: number;
  institution?: string[];
  authors?: string[];
  release_date: string;
  file_path: string;
  date_inserted: string;
}

export const proteinStructureRecords: ProteinStructureFixtureRecord[] = [
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

export interface EpitopeFixtureRecord {
  epitope_id: string;
  epitope_type: string;
  epitope_sequence: string;
  organism: string;
  taxon_id: number;
  taxon_lineage_ids: number[];
  protein_name: string;
  protein_accession: string;
  /**
   * Array-valued on the wire — `epitope.host_name` is registry-declared
   * multi-valued (see the `multipleFields.epitope` set in
   * src/lib/data-api/resources.ts). A prior drift had the server-side loopback
   * mock serving this as a bare string; this is the corrected, real-API shape.
   */
  host_name: string[];
  total_assays: number;
  assay_results: string[];
  bcell_assays: number;
  tcell_assays: number;
  mhc_assays: number;
  comments: string;
  date_inserted: string;
}

export const epitopeRecord: EpitopeFixtureRecord = {
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
};

export interface EpitopeAssayFixtureRecord {
  assay_id: string;
  epitope_id: string;
  assay_type: string;
  assay_method: string;
  assay_group: string;
  assay_result: string;
  /** Single-valued on the wire — epitope_assay.host_name is NOT registry-multivalued. */
  host_name: string;
  pmid: string;
  title: string;
  protein_name: string;
  epitope_type: string;
}

export const epitopeAssayRecords: EpitopeAssayFixtureRecord[] = [
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

export interface ExperimentFixtureRecord {
  exp_id: string;
  study_name: string;
  study_title: string;
  study_description: string;
  study_pi: string;
  study_institution: string;
  exp_name: string;
  exp_title: string;
  exp_description: string;
  public_repository: string;
  public_identifier: string;
  pmid: string;
  exp_type: string;
  measurement_technique: string;
  organism: string[];
  taxon_id: number[];
  taxon_lineage_ids: number[];
  strain: string[];
  treatment_type: string[];
  treatment_name: string[];
  samples: number;
  biosets: number;
  genome_id: string[];
  date_inserted: string;
}

export const experimentRecord: ExperimentFixtureRecord = {
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

export interface BiosetFixtureRecord {
  bioset_id: string;
  exp_id: string;
  study_name: string;
  exp_name: string;
  exp_title: string;
  exp_type: string;
  bioset_name: string;
  bioset_description: string;
  bioset_type: string;
  bioset_criteria: string;
  organism: string;
  strain: string;
  entity_count: number;
  date_inserted: string;
}

export const biosetRecord: BiosetFixtureRecord = {
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
};

export interface StrainFixtureRecord {
  id: string;
  taxon_id: number;
  taxon_lineage_ids: number[];
  family?: string;
  genus?: string;
  species: string;
  strain: string;
  subtype: string;
  genome_ids: string[];
  genbank_accessions: string[];
  segment_count: number;
  status: string;
  host_common_name?: string;
  isolation_country?: string;
  collection_date?: string;
  collection_year?: number;
  "1_pb2"?: string[];
  "4_ha"?: string[];
}

export const strainRecords: StrainFixtureRecord[] = [
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

export interface SurveillanceFixtureRecord {
  id: string;
  sample_identifier: string;
  contributing_institution?: string;
  sample_material?: string;
  collection_date?: string;
  collection_year?: number;
  collection_country?: string;
  collection_state_province?: string;
  collection_latitude?: string;
  collection_longitude?: string;
  pathogen_test_type: string[];
  pathogen_test_result?: string[];
  pathogen_test_interpretation?: string[];
  pathogen_type?: string;
  host_identifier?: string;
  host_common_name?: string;
}

export const surveillanceRecord: SurveillanceFixtureRecord = {
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

export const ambiguousSurveillanceRecords: SurveillanceFixtureRecord[] = [
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

export interface SerologyFixtureRecord {
  id: string;
  sample_identifier: string;
  contributing_institution?: string;
  host_identifier?: string;
  host_type?: string;
  host_species?: string;
  host_common_name?: string;
  collection_date?: string;
  collection_year?: number;
  collection_country?: string;
  collection_state?: string;
  test_type: string;
  test_result?: string;
  test_interpretation?: string;
  serotype?: string;
}

export const serologyRecord: SerologyFixtureRecord = {
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

export const ambiguousSerologyRecords: SerologyFixtureRecord[] = [
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

export interface GenomeAmrFixtureRecord {
  id: string;
  taxon_id: number;
  genome_id: string;
  genome_name: string;
  antibiotic: string;
  resistant_phenotype: string;
  evidence: string;
  /**
   * Array-valued on the wire — `genome_amr.pmid` is registry-declared
   * multi-valued (the `multipleFields.genome_amr` set in
   * src/lib/data-api/resources.ts, surfaced as `cardinality: "multiple"`),
   * which is what makes the column unsortable. The test reads that
   * declaration rather than restating it here.
   */
  pmid: string[];
  /**
   * String-valued deliberately: `measurement_value` and
   * `testing_standard_year` are left to `inferType`'s string default so the
   * gateway does not reject non-numeric facet values such as ">=" ranges.
   */
  measurement_value: string;
  measurement_sign: string;
  measurement_unit: string;
  laboratory_typing_method: string;
  testing_standard: string;
  testing_standard_year: string;
  computational_method: string;
}

/**
 * No transport serves this row yet — nothing in the suite requests
 * `data/genome_amr` rows, and the AMR landing chart is fed by a facet-pivot
 * fixture, not by rows. It exists as the concrete row Task 19 could not
 * supply when it registered the resource: `__tests__/records.test.ts` reads
 * `getResourceDefinition("genome_amr")` and asserts this row against the
 * registry's own derived `cardinality` and `type`, so editing either side
 * alone fails. It says nothing about what the live BV-BRC core returns — no
 * test may reach a live backend. Wire it into a transport when a caller
 * appears.
 */
export const genomeAmrRecord: GenomeAmrFixtureRecord = {
  id: "genome-amr-backend-901",
  taxon_id: 234,
  genome_id: "234.1",
  genome_name: "Brucella suis 1330",
  antibiotic: "ampicillin",
  resistant_phenotype: "Resistant",
  evidence: "Laboratory Method",
  pmid: ["12345678", "23456789"],
  measurement_value: "32",
  measurement_sign: ">=",
  measurement_unit: "mg/L",
  laboratory_typing_method: "Broth dilution",
  testing_standard: "CLSI",
  testing_standard_year: "2019",
  computational_method: "PATRIC AMR classifier",
};

export interface PpiFixtureRecord {
  id: string;
  genome_id_a: string;
  genome_name_a: string;
  interactor_a: string;
  feature_id_a: string;
  refseq_locus_tag_a: string;
  gene_a: string;
  interactor_desc_a: string;
  genome_id_b: string;
  genome_name_b: string;
  interactor_b: string;
  feature_id_b: string;
  refseq_locus_tag_b: string;
  gene_b: string;
  interactor_desc_b: string;
  category: string;
  interaction_type: string[];
  detection_method: string[];
  evidence: string[];
  score: number;
}

/**
 * The total the loopback reports for an unnarrowed `ppi` count
 * (`e2eDeterministicCounts.ppi`). The browser layer does NOT read this: it
 * reports `rows.length` for whatever a spec asked it to build, because a
 * browser override answers a request the spec itself scoped. This constant
 * lives here so the server-side number has a name and a home next to the row
 * builder, not because the two layers share it.
 */
export const brucellaPpiTotal = 4358;

/** Build `count` synthetic Brucella melitensis (taxon 234) PPI rows. */
export function buildBrucellaPpiRecords(count: number): PpiFixtureRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `ppi-${String(index).padStart(4, "0")}`,
    genome_id_a: "224914.16",
    genome_name_a: "Brucella melitensis bv. 1 str. 16M [WGS]",
    interactor_a: `fig|224914.16.peg.${String(600 + index)}`,
    feature_id_a: `PATRIC.224914.16.feature-a-${String(index)}`,
    refseq_locus_tag_a: `BAWG_${String(1000 + index)}`,
    gene_a: "",
    interactor_desc_a: "6,7-dimethyl-8-ribityllumazine synthase",
    genome_id_b: "224914.16",
    genome_name_b: "Brucella melitensis bv. 1 str. 16M [WGS]",
    interactor_b: `fig|224914.16.peg.${String(2400 + index)}`,
    feature_id_b: `PATRIC.224914.16.feature-b-${String(index)}`,
    refseq_locus_tag_b: `BAWG_${String(2000 + index)}`,
    gene_b: "",
    interactor_desc_b: "CrcB protein",
    category: "PPI",
    interaction_type: ["predicted interaction"],
    detection_method: ["predictive text mining"],
    evidence: ["experimental"],
    score: 2.5316925,
  }));
}

/**
 * BV-BRC *website* API taxonomy shape — `GET {BVBRC_WEBSITE_API_URL}/taxonomy/<id>`,
 * consumed by `fetchOrganismTaxonomy` in
 * src/lib/services/organisms/taxonomy.ts. Deliberately NOT the same shape as
 * {@link TaxonomyFixtureRecord}, which models the Data API `taxonomy` core
 * (`/api/data/taxonomy`): the website endpoint answers a single object with
 * numeric ids and no `other_names`/`parent_id`/`description`, and the two
 * transports really do differ here. Keeping both shapes named separately is
 * what stops a fixture from being "fixed" into the wrong one.
 */
export interface OrganismTaxonomyFixtureRecord {
  taxon_id: number;
  taxon_name: string;
  lineage_names: string[];
  lineage_ids: number[];
  taxon_rank: string;
  genomes: number;
}

/**
 * BV-BRC *website* API summary shape — `GET
 * {BVBRC_WEBSITE_API_URL}/data/summary_by_taxon/<id>`, consumed by
 * `fetchOrganismSummary` in src/lib/services/organisms/summary.ts. The
 * SCREAMING keys (`CDS`, `PDB`) are the real wire names, not a naming-rule
 * violation — `fetchOrganismSummary` reads `payload.CDS` / `payload.PDB`.
 */
export interface OrganismSummaryFixtureRecord {
  count: number;
  unique_family: number;
  unique_genus: number;
  unique_species: number;
  CDS: number;
  mat_peptide: number;
  PDB: number;
}

const bacteriaGenomeCount = 1_337_420;
const virusesGenomeCount = 890_123;
const allOrganismsGenomeCount = 9_800_000;
const brucellaGenomeCount = 1909;
const mycobacteriumGenomeCount = 62_310;
const influenzaAGenomeCount = 245_000;
const caliciviridaeGenomeCount = 86_222;
const alphainfluenzavirusInfluenzaeGenomeCount = 1_876_178;

export const bacteriaOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord = {
  taxon_id: 2,
  taxon_name: "Bacteria",
  lineage_names: ["cellular organisms", "Bacteria"],
  lineage_ids: [131567, 2],
  taxon_rank: "superkingdom",
  genomes: bacteriaGenomeCount,
};

export const virusesOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord = {
  taxon_id: 10239,
  taxon_name: "Viruses",
  lineage_names: ["Viruses"],
  lineage_ids: [10239],
  taxon_rank: "superkingdom",
  genomes: virusesGenomeCount,
};

export const cellularOrganismsTaxonomyRecord: OrganismTaxonomyFixtureRecord = {
  taxon_id: 131567,
  taxon_name: "cellular organisms",
  lineage_names: ["cellular organisms"],
  lineage_ids: [131567],
  taxon_rank: "no rank",
  genomes: allOrganismsGenomeCount,
};

export const brucellaOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord = {
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
  genomes: brucellaGenomeCount,
};

/**
 * Mycobacterium (NCBI taxon 1763) — the second taxon the a11y suite scans.
 * It exists so `/taxonomy/1763` renders a real organism landing page instead
 * of the framework error boundary `fetchOrganismTaxonomy` raised when the
 * loopback answered that endpoint with an empty object.
 */
export const mycobacteriumOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord =
  {
    taxon_id: 1763,
    taxon_name: "Mycobacterium",
    lineage_names: [
      "cellular organisms",
      "Bacteria",
      "Bacillati",
      "Actinomycetota",
      "Actinomycetes",
      "Mycobacteriales",
      "Mycobacteriaceae",
      "Mycobacterium",
    ],
    lineage_ids: [131567, 2, 1783272, 201174, 1760, 85007, 1762, 1763],
    taxon_rank: "genus",
    genomes: mycobacteriumGenomeCount,
  };

/**
 * Influenza A virus — lineage includes "Orthomyxoviridae" so `hasStrains` is
 * true. Used by the strains-tab e2e tests, which need a taxon whose Strains
 * tab is enabled.
 */
export const influenzaAOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord = {
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
  genomes: influenzaAGenomeCount,
};

/**
 * Alphainfluenzavirus influenzae — lineage includes
 * "Alphainfluenzavirus influenzae" so `hasSerology` is true. Used by the
 * serology-tab e2e test.
 */
export const alphainfluenzavirusInfluenzaeOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord =
  {
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
      10239, 2559587, 2732396, 2497569, 2497571, 2497577, 2499411, 11308,
      197911, 2955291,
    ],
    taxon_rank: "species",
    genomes: alphainfluenzavirusInfluenzaeGenomeCount,
  };

/** Caliciviridae — virus family used by the domains-and-motifs e2e tests. */
export const caliciviridaeOrganismTaxonomyRecord: OrganismTaxonomyFixtureRecord =
  {
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
    genomes: caliciviridaeGenomeCount,
  };

/**
 * Every taxon the BV-BRC website mock knows, keyed by taxon id as it appears
 * in the URL path. One table so "which taxa exist" is a single fact rather
 * than a chain of `if (endpoint === ...)` branches, and so the summary table
 * below can be checked against it.
 */
export const organismTaxonomyRecords: Record<
  string,
  OrganismTaxonomyFixtureRecord
> = {
  "2": bacteriaOrganismTaxonomyRecord,
  "234": brucellaOrganismTaxonomyRecord,
  "1763": mycobacteriumOrganismTaxonomyRecord,
  "10239": virusesOrganismTaxonomyRecord,
  "11520": influenzaAOrganismTaxonomyRecord,
  "11974": caliciviridaeOrganismTaxonomyRecord,
  "131567": cellularOrganismsTaxonomyRecord,
  "2955291": alphainfluenzavirusInfluenzaeOrganismTaxonomyRecord,
};

export const bacteriaSummaryRecord: OrganismSummaryFixtureRecord = {
  count: bacteriaGenomeCount,
  unique_family: 391,
  unique_genus: 5432,
  unique_species: 82_915,
  CDS: 482_001_224,
  mat_peptide: 23_144,
  PDB: 9821,
};

export const virusesSummaryRecord: OrganismSummaryFixtureRecord = {
  count: virusesGenomeCount,
  unique_family: 212,
  unique_genus: 2841,
  unique_species: 14_302,
  CDS: 12_803_441,
  mat_peptide: 419_820,
  PDB: 3201,
};

export const allOrganismsSummaryRecord: OrganismSummaryFixtureRecord = {
  count: allOrganismsGenomeCount,
  unique_family: 1204,
  unique_genus: 41_200,
  unique_species: 510_000,
  CDS: 980_000_000,
  mat_peptide: 450_000,
  PDB: 21_000,
};

export const brucellaSummaryRecord: OrganismSummaryFixtureRecord = {
  count: brucellaGenomeCount,
  unique_family: 1,
  unique_genus: 1,
  unique_species: 12,
  CDS: 6_281_044,
  mat_peptide: 0,
  PDB: 214,
};

export const mycobacteriumSummaryRecord: OrganismSummaryFixtureRecord = {
  count: mycobacteriumGenomeCount,
  unique_family: 1,
  unique_genus: 1,
  unique_species: 204,
  CDS: 264_812_900,
  mat_peptide: 0,
  PDB: 1873,
};

export const influenzaASummaryRecord: OrganismSummaryFixtureRecord = {
  count: influenzaAGenomeCount,
  unique_family: 1,
  unique_genus: 1,
  unique_species: 1,
  CDS: 2_205_000,
  mat_peptide: 98_400,
  PDB: 612,
};

export const caliciviridaeSummaryRecord: OrganismSummaryFixtureRecord = {
  count: caliciviridaeGenomeCount,
  unique_family: 1,
  unique_genus: 11,
  unique_species: 64,
  CDS: 258_666,
  mat_peptide: 74_180,
  PDB: 143,
};

export const alphainfluenzavirusInfluenzaeSummaryRecord: OrganismSummaryFixtureRecord =
  {
    count: alphainfluenzavirusInfluenzaeGenomeCount,
    unique_family: 1,
    unique_genus: 1,
    unique_species: 1,
    CDS: 16_885_602,
    mat_peptide: 750_471,
    PDB: 1204,
  };

/**
 * Summary counters keyed by the same taxon ids as
 * {@link organismTaxonomyRecords}. The two tables are kept 1:1 — a taxon the
 * landing page can resolve must also have a summary, because the page fetches
 * both — and `count` always equals that taxon's `genomes`. Both invariants are
 * pinned in src/lib/e2e-fixtures/__tests__/records.test.ts.
 */
export const organismSummaryRecords: Record<
  string,
  OrganismSummaryFixtureRecord
> = {
  "2": bacteriaSummaryRecord,
  "234": brucellaSummaryRecord,
  "1763": mycobacteriumSummaryRecord,
  "10239": virusesSummaryRecord,
  "11520": influenzaASummaryRecord,
  "11974": caliciviridaeSummaryRecord,
  "131567": allOrganismsSummaryRecord,
  "2955291": alphainfluenzavirusInfluenzaeSummaryRecord,
};

/**
 * Lookups rather than bare indexing: the tables above are
 * `Record<string, …>`, and this project does not enable
 * `noUncheckedIndexedAccess`, so `table[id]` types as present even for a taxon
 * that is not. These return `undefined` honestly so callers must decide what
 * an unknown taxon means.
 */
export function findOrganismTaxonomyRecord(
  taxonId: string,
): OrganismTaxonomyFixtureRecord | undefined {
  return Object.hasOwn(organismTaxonomyRecords, taxonId)
    ? organismTaxonomyRecords[taxonId]
    : undefined;
}

export function findOrganismSummaryRecord(
  taxonId: string,
): OrganismSummaryFixtureRecord | undefined {
  return Object.hasOwn(organismSummaryRecords, taxonId)
    ? organismSummaryRecords[taxonId]
    : undefined;
}

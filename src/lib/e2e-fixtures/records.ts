/**
 * Canonical E2E fixture records — the single source of truth for deterministic
 * domain data shared by BOTH mock transport layers:
 *
 *   - Browser-side:  e2e/fixtures/overrides/catchall.ts (via `applyBackendMocks`)
 *   - Server-side:   src/app/api/e2e-mock/[...path]/route.ts (loopback mock)
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

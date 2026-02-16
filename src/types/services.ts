export interface Library {
  id: string;
  name: string;
  type: "paired" | "single" | "sra";
  files?: string[];
  /** Optional sample identifier; used by services that submit sample_id per library (e.g. Taxonomic Classification) */
  sampleId?: string;
  /** Optional sample date (e.g. MM/DD/YYYY); used by services that submit sample_level_date per library (e.g. SARS-CoV-2 Wastewater) */
  sampleLevelDate?: string;
  /** Optional study title from SRA API; included in srr_libs when present */
  title?: string;
  platform?: string;
  interleaved?: boolean;
  read_orientation_outward?: boolean;
}

export interface Genome {
  id: string;
  name: string;
}

export interface ServiceInfoPopup {
  title: string;
  description?: string;
  sections?: ServiceInfoSection[];
}

interface ServiceInfoSection {
  header?: string;
  description?: string;
  subsections?: ServiceInfoSubsection[];
}

interface ServiceInfoSubsection {
  subheader: string;
  subdescription?: string;
}

export const primerOptions = [
  { id: "artic", label: "ARTIC", versions: ["v5.3.2", "v4.1", "v4", "v3", "v2", "v1"] },
  { id: "midnight", label: "Midnight", versions: ["v1"] },
  { id: "qiagen", label: "Qiagen", versions: ["v1"] },
  { id: "swift", label: "Swift", versions: ["v1"] },
  { id: "varskip", label: "VarSkip", versions: ["v2", "v1a"] },
  { id: "varskip-long", label: "VarSkip-Long", versions: ["v1a"] }
];

export const HaReferenceTypes = [
  { id: "H1_PR34", label: "H1PR34" },
  { id: "H1_1933", label: "H11933" },
  { id: "H1post1995", label: "H1post1995" },
  { id: "H1N1pdm", label: "H1N1pdm" },
  { id: "H2", label: "H2" },
  { id: "H3", label: "H3" },
  { id: "H4", label: "H4" },
  { id: "H5mEA-nonGsGD", label: "H5mEAnonGsGD" },
  { id: "H5", label: "H5" },
  { id: "H5c221", label: "H5c221" },
  { id: "H6", label: "H6" },
  { id: "H7N3", label: "H7N3" },
  { id: "H7N7", label: "H7N7" },
  { id: "H8", label: "H8" },
  { id: "H9", label: "H9" },
  { id: "H10", label: "H10" },
  { id: "H11", label: "H11" },
  { id: "H12", label: "H12" },
  { id: "H13", label: "H13" },
  { id: "H14", label: "H14" },
  { id: "H15", label: "H15" },
  { id: "H16", label: "H16" },
  { id: "H17", label: "H17" },
  { id: "H18", label: "H18" },
  { id: "B/HONG KONG/8/73", label: "BHongKong" },
  { id: "B/FLORIDA/4/2006", label: "BFlorida" },
  { id: "B/HUMAN/BRISBANE/60/2008", label: "BBrisbane" },
];

export const subspeciesClassificationSpeciesList = [
  { id: "adenoviridae_mastadenovirus_A", label: "Adenoviridae - Human mastadenovirus A [complete genome, genomic RNA]" },
  { id: "adenoviridae_mastadenovirus_B", label: "Adenoviridae - Human mastadenovirus B [complete genome, genomic RNA]" },
  { id: "adenoviridae_mastadenovirus_C", label: "Adenoviridae - Human mastadenovirus C [complete genome, genomic RNA]" },
  { id: "adenoviridae_mastadenovirus_E", label: "Adenoviridae - Human mastadenovirus E [complete genome, genomic RNA]" },
  { id: "adenoviridae_mastadenovirus_F", label: "Adenoviridae - Human mastadenovirus F [complete genome, genomic RNA]" },
  { id: "caliciviridae_vp2", label: "Caliciviridae - Norovirus [(VP2 gene, genomic RNA)|" },
  { id: "caliciviridae_vp1", label: "Caliciviridae - Norovirus [VP1 gene, genomic RNA]" },
  { id: "flaviviridae_bovine", label: "Flaviviridae - Bovine viral diarrhea virus [5'UTR region, genomic RNA]" },
  { id: "flaviviridae_dengue", label: "Flaviviridae - Dengue virus (complete genome, genomic RNA)" },
  { id: "flaviviridae_hepatitis_c", label: "Flaviviridae - Hepatitis C virus [polyprotein gene, genomic RNA]" },
  { id: "flaviviridae_japanese_encephalitis", label: "Flaviviridae - Japanese encephalitis virus [complete genome, genomic RNA]" },
  { id: "flaviviridae_murray_valley_encephalitis", label: "Flaviviridae - Murray Valley encephalitis virus [envelope protein (E), genomic RNA]" },
  { id: "flaviviridae_st_louis_encephalitis", label: "Flaviviridae - St. Louis encephalitis virus (polyprotein gene, genomic RNA]" },
  { id: "flaviviridae_tick_borne_encephalitis", label: "Flaviviridae - Tick-borne encephalitis virus (polyprotein gene, genomic RNA]" },
  { id: "flaviviridae_west_nile", label: "Flaviviridae - West Nile virus [complete genome, genomic RNA]" },
  { id: "flaviviridae_yellow_fever", label: "Flaviviridae - Yellow fever virus [polyprotein mRNA, mRNA]" },
  { id: "flaviviridae_zika", label: "Flaviviridae - Zika virus [complete genome, genomic RNA]" },
  { id: "orthomyxoviridae_influenza_h5", label: "Orthomyxoviridae - Influenza A H5 [Hemagglutinin gene, genomic RNA]" },
  { id: "orthomyxoviridae_swine_influenza_h1", label: "Orthomyxoviridae - Swine influenza H1 (global classification) (Hemagglutinin gene, genomic RNA]" },
  { id: "orthomyxoviridae_swine_influenza_h1_us", label: "Orthomyxoviridae - Swine influenza H1 (US classification) [Hemagglutinin gene, genomic RNA]" },
  { id: "orthomyxoviridae_swine_influenza_h3", label: "Orthomyxoviridae - Swine influenza H3 (global classification, beta version) [Hemagglutinin gene, genomic RNA]" },
  { id: "paramyxoviridae_measles_morbillivirus", label: "Paramyxoviridae - Measles morbillivirus (complete genome, genomic RNA]" },
  { id: "paramyxoviridae_mumps_orthorubulavirus", label: "Paramyxoviridae - Mumps orthorubulavirus (complete genome, genomic RNA]" },
  { id: "poxviridae_monkeypox", label: "Poxviridae - Monkeypox virus [complete genome, genomic DNA]" },
  { id: "reoviridae_rotavirus_a", label: "Reoviridae - Rotavirus A [complete genome, genomic RNA]" },
];

export const blastPrecomputedDatabases = [
  { value: 'bacteria-archaea', label: 'Reference and representative genomes (bacteria, archaea)', db_source: 'precomputed_database'},
  { value: 'viral-reference', label: 'Reference and representative genomes (viruses)', db_source: 'precomputed_database' },
  { value: 'selGenome', label: 'Search within selected genome list', db_source: 'selGenome' },
  { value: 'selGroup', label: 'Search within selected genome group', db_source: 'selGroup' },
  { value: 'selFeatureGroup', label: 'Search within selected feature group', db_source: 'selFeatureGroup' },
  { value: 'selTaxon', label: 'Search within a taxon', db_source: 'selTaxon' },
  { value: 'selFasta', label: 'Search within selected FASTA file', db_source: 'selFasta' },
];

export const blastDatabaseTypes = [
  { value: 'fna', label: 'Genome sequences (NT)' },
  { value: 'faa', label: 'Proteins (AA)' },
  { value: 'ffn', label: 'Genes (NT)' },
  { value: 'frn', label: 'RNAs (NT)' }
];

// BLAST Database Type Mapping based on search program and database source
// Mapping: GSNT = fna (Genome sequences), GNT = ffn (Genes), RNT = frn (RNAs), AA = faa (Proteins)
export const blastDatabaseTypeMap: Record<
  string, // blast_program
  Record<string, string[]> // db_source -> available db_types
> = {
  blastn: {
    "bacteria-archaea": ["fna", "ffn"],
    "viral-reference": ["fna", "ffn"],
    "selGenome": ["fna", "ffn", "frn"],
    "selGroup": ["fna", "ffn", "frn"],
    "selFeatureGroup": ["fna", "ffn", "frn"],
    "selTaxon": ["fna", "ffn", "frn"],
    "selFasta": ["fna"],
  },
  blastp: {
    "bacteria-archaea": ["faa"],
    "viral-reference": ["faa"],
    "selGenome": ["faa"],
    "selGroup": ["faa"],
    "selFeatureGroup": ["faa"],
    "selTaxon": ["faa"],
    "selFasta": ["faa"],
  },
  blastx: {
    "bacteria-archaea": ["faa"],
    "viral-reference": ["faa"],
    "selGenome": ["faa"],
    "selGroup": ["faa"],
    "selFeatureGroup": ["faa"],
    "selTaxon": ["faa"],
    "selFasta": ["faa"],
  },
  tblastn: {
    "bacteria-archaea": ["fna", "ffn"],
    "viral-reference": ["fna", "ffn"],
    "selGenome": ["fna", "ffn", "frn"],
    "selGroup": ["fna", "ffn", "frn"],
    "selFeatureGroup": ["fna", "ffn", "frn"],
    "selTaxon": ["fna", "ffn", "frn"],
    "selFasta": ["fna"],
  },
};
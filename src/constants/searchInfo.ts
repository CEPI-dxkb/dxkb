export interface SearchTerm {
  id: string;
  termTitle: string;
}

export interface SearchType {
  id: string;
  typeTitle: string;
}

// These aren't really used in the current iteration, but are retained in case we want to use them later
export const searchTerms: readonly SearchTerm[] = [
  {
    id: "option_and",
    termTitle: "All Terms",
  },
  {
    id: "option_or",
    termTitle: "Any Term",
  },
  {
    id: "option_and2",
    termTitle: "All Exact Terms",
  },
  {
    id: "option_or2",
    termTitle: "Any Exact Term",
  },
];

export const searchTypes: readonly SearchType[] = [
  {
    id: "everything",
    typeTitle: "All Data Types",
  },
  {
    id: "genome",
    typeTitle: "Genomes",
  },
  {
    id: "strain",
    typeTitle: "Strains",
  },
  {
    id: "genome_feature",
    typeTitle: "Features",
  },
  /*
  {
    id: "protein",
    typeTitle: "Proteins",
  },
  */
  /*
  {
    id: "sp_gene",
    typeTitle: "Specialty Genes",
  },
  */
  {
    id: "protein_feature",
    typeTitle: "Domains and Motifs",
  },
  {
    id: "epitope",
    typeTitle: "Epitopes",
  },
  {
    id: "protein_structure",
    typeTitle: "Protein Structures",
  },
  /*
  {
    id: "pathway",
    typeTitle: "Pathways",
  },
  {
    id: "subsystem",
    typeTitle: "Subsystems",
  },
  */
  {
    id: "surveillance",
    typeTitle: "Surveillance",
  },
  {
    id: "serology",
    typeTitle: "Serology",
  },
  {
    id: "taxonomy",
    typeTitle: "Taxa",
  },
  {
    id: "experiment",
    typeTitle: "Experiments",
  },
  /*
  {
    id: "antibiotic",
    typeTitle: "Antibiotic",
  },
  */
];

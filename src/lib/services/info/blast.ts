import type { ServiceInfoPopup } from "@/types/services";

export const blastServiceInfo: ServiceInfoPopup = {
  title: "BLAST Overview",
  description:
    "The BLAST service integrates the BLAST (Basic Local Aligment Search Tool) algorithms to perform searches against against public or private genomes in BV-BRC or other reference databases using a DNA or protein sequence and find matching genomes, genes, RNAs, or proteins.",
};

export const blastServiceSearchProgram: ServiceInfoPopup = {
  title: "Search Program",
  description:
    "There are four BLAST programs provided by BV-BRC, and each has a specific query sequence and database. Clicking on the button in front of the program name will select it and will also select the appropriate databases.",
  sections: [
    {
      header: "BLASTN",
      description:
        "The query sequence is DNA (nucleotide), and when enabled the program will search against DNA databases of contig or gene sequences.",
    },
    {
      header: "BLASTX",
      description:
        "The query sequence is DNA (nucleotide), and when enabled the program will search against the protein sequence database.",
    },
    {
      header: "BLASTP",
      description:
        "The query sequence is protein (amino acid), and when enabled the program will search against the protein sequence database.",
    },
    {
      header: "tBLASTn",
      description:
        "The query sequence is protein (amino acid), and when enabled the program will search against DNA databases of contig or gene sequences.",
    },
  ],
};

export const blastServiceInputSource: ServiceInfoPopup = {
  title: "Input Source",
  description:
    "There are three types of Input sources that are provided by BV-BRC:",
  sections: [
    {
      header: "Enter sequence",
      description: "Paste the input sequence into the box.",
    },
    {
      header: "Select FASTA file",
      description: "Choose FASTA file that has been uploaded to the Workspace.",
    },
    {
      header: "Select feature group",
      description:
        "Choose a feature (gene/protein) that has been saved in the Workspace.",
    },
  ],
};

export const blastServiceDatabaseSource: ServiceInfoPopup = {
  title: "Database Source",
  description:
    "DXKB / BV-BRC have different databases to choose from for the source to search wihin:",
  sections: [
    {
      header: "Reference and representative genomes (bacteria, archaea)",
      description: "Those designated by the NCBI. This is the default.",
    },
    {
      header: "Reference and representative genomes (virus)",
      description: "Those designated by the NCBI.",
    },
    {
      header: "Selected genome list",
      description:
        "Clicking on 'Search within genome list' in the drop-down box will open a new source box where desired genomes can be added.",
    },
    {
      header: "Selected genome group",
      description: "Genome group saved in the Workspace.",
    },
    {
      header: "Selected feature group",
      description: "Feature (gene/protein) group saved in the workspace.",
    },
    {
      header: "Taxon",
      description: "Selected taxonomic level from the database.",
    },
    {
      header: "Selected fasta file",
      description: "FASTA file that has been uploaded to the Workspace.",
    },
  ],
};

export const blastServiceDatabaseType: ServiceInfoPopup = {
  title: "Database Type",
  description: "There are three database types:",
  sections: [
    {
      header: "Genome Sequences (NT)",
      description:
        "Genomic sequences from bacterial and viral genomes in DXKB / BV-BRC, i.e. chromosomes, contigs, plasmids, segments, and partial genomic sequences",
    },
    {
      header: "Genes (NT)",
      description:
        "Gene sequences from bacterial and viral genomes in DXKB / BV-BRC.",
    },
    {
      header: "Proteins (AA)",
      description:
        "Protein sequences from bacterial and viral genomes in DXKB / BV-BRC.",
    },
  ],
};

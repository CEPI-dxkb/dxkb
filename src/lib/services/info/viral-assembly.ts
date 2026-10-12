import type { ServiceInfoPopup } from "@/types/services";

export const viralAssemblyInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The Viral Assembly Service utilizes IRMA (Iterative Refinement Meta-Assembler) to assemble viral genomes. Users must select the virus genome for processing. This service is currently in beta; any feedback or improvement is welcomed.",
};

export const viralAssemblyInputFile: ServiceInfoPopup = {
  title: "Input File",
  description:
    "Select paired-end reads, single reads, or provide an SRA run accession.",
  sections: [
    {
      header: "Paired Read Library",
      subsections: [
        {
          subheader: "Read File 1 & 2",
          subdescription:
            "Select the two read files that make up the paired-end library.",
        },
      ],
    },
    {
      header: "Single Read Library",
      subsections: [
        {
          subheader: "Read File",
          subdescription: "Select the FASTQ file containing the reads.",
        },
      ],
    },
    {
      header: "SRA Run Accession",
      description:
        "Enter an SRA run accession (e.g. SRR...) to use reads from the NCBI Sequence Read Archive. The accession is validated before submission.",
    },
  ],
};

export const viralAssemblyParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Assembly Strategy",
      description:
        "IRMA (Iterative Refinement Meta-Assembler) assembles viral genomes using the selected reference database. Reference Guided Assembly assembles the reads against a reference you provide.",
    },
    {
      header: "Reference Database",
      description:
        "For IRMA, select the module for the virus and the sequencing data (e.g. Influenza A & B, SARS-CoV-2 & MERS-CoV, RSV A & B groups).",
    },
    {
      header: "Reference",
      description:
        "For Reference Guided Assembly, enter one or more GenBank accessions separated by commas (e.g. NC_045512.2,MN908947.3), or select a DNA FASTA or contigs file from your workspace.",
    },
    {
      header: "Output Folder",
      description:
        "Navigate the workspace to or create the directory for the results.",
    },
    {
      header: "Output Name",
      description:
        "The text entered here will be used to create the job results directory.",
    },
  ],
};

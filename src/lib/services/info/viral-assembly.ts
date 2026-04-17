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
        "IRMA (Iterative Refinement Meta-Assembler) is used to assemble viral genomes from the selected reference database.",
    },
    {
      header: "Reference Database",
      description:
        "Select the virus reference (e.g. FLU, CoV, RSV, EBOLA) used for assembly.",
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

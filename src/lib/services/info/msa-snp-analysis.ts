import type { ServiceInfoPopup } from "@/types/services";

export const msaSNPAnalysisInfo: ServiceInfoPopup = {
  title: "Multiple Sequence Alignment and SNP / Variation Analysis Overview",
  description:
    "The Multiple Sequence Alignment (MSA) and Single Nucleotide Polymorphism (SNP)/Variation Analysis Service \
        allows users to choose an alignment algorithm to align sequences selected from: a search result, a FASTA file saved to the workspace, \
        or through simply cutting and pasting. The service can also be used for variation and SNP analysis with feature groups, FASTA files, \
        aligned FASTA files, and user input FASTA records. If a single alignment file is given, then only the variation analysis is run. \
        If multiple inputs are given, the program concatenates all sequence records and aligns them. If a mixture of protein and nucleotides \
        are given, then nucleotides are converted to proteins.",
};

export const msaSNPAnalysisStartWith: ServiceInfoPopup = {
  title: "Start with",
  description: "Choose either",
  sections: [
    {
      header: "Unaligned sequences",
      description: "Set of sequences, not previously aligned.",
    },
    {
      header: "Aligned sequences",
      description: "Pre-aligned set of sequences",
    },
  ],
};

export const msaSNPAnalysisSelectSequences: ServiceInfoPopup = {
  title: "Comparison sequences",
  description: "Choose one of the following options:",
  sections: [
    {
      header: "Select Feature Group",
      description:
        "Users may input a nucleic acid or protein FASTA file containing a previously selected “Feature Group” (eg. CDS, tRNA etc.) from their workspace here, either in addition to the FASTA text input, or as an alternative. Choose either DNA or protein sequences.",
    },
    {
      header: "Select DNA or Protein FASTA File",
      description:
        "Users may input a nucleic acid or protein FASTA file from their workspace or upload their own data here, either in addition to the FASTA text input, or as an alternative.",
    },
    {
      header: "Input FASTA sequence",
      description:
        "Users may enter custom sequences here by pasting in FASTA formatted sequences.",
    },
  ],
};

export const msaSNPAnalysisParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Aligner",
      description: "Choose one of the aligmnent algorithm options:",
      subsections: [
        {
          subheader: "Mafft (default)",
        },
        {
          subheader: "MUSCLE",
        },
      ],
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description:
        "A user-specified label. This name will appear in the workspace when the annotation job is complete.",
    },
  ],
};

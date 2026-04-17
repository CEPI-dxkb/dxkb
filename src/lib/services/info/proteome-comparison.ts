import type { ServiceInfoPopup } from "@/types/services";

export const proteomeComparisonInfo: ServiceInfoPopup = {
  title: "Proteome Comparison Overview",
  description:
    "The bacterial Proteome Comparison Service performs protein sequence-based genome comparison \
        using bidirectional BLASTP. This service allows users to select up to eight genomes, either public or private, \
        and compare them to a user-selected or supplied reference genome. The proteome comparison result is displayed as an \
        interactive circular genome view and is downloadable as a print-quality image or tabular comparison results.",
};

export const proteomeComparisonParameters: ServiceInfoPopup = {
  title: "Parameters",

  sections: [
    {
      header: "Advanced parameters",
      subsections: [
        {
          subheader: "Minimum % coverage",
          subdescription:
            "Minimum percent sequence coverage of query and subject in blast. Use up or down arrows to change the value. The default value is 30%.",
        },
        {
          subheader: "BLAST E value",
          subdescription: "Maximum BLAST E value. The default value is 1e-5.",
        },
        {
          subheader: "Minimum % Identity",
          subdescription:
            "Minimum percent sequence identity of query and subject in BLAST. Use up or down arrows to change the value. The default value is 10%.",
        },
      ],
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description: "Name used to uniquely identify results.",
    },
  ],
};

export const proteomeComparisonComparisonGenomes: ServiceInfoPopup = {
  title: "Comparison Genomes Selection",
  description:
    "Select up to total of 9 genomes from the genome list or FASTA files or a feature groups and use the plus buttons to place the genomes to the table.",
  sections: [
    {
      header: "Select genome",
      description: "Type or select a genome name from the genome list.",
    },
    {
      header: "And/or select FASTA file",
      description:
        "Select or upload an external genome file in protein FASTA format.",
    },
    {
      header: "And/or select feature group",
      description: "Select a feature group from the workspace.",
    },
  ],
};

export const proteomeComparisonReferenceGenome: ServiceInfoPopup = {
  title: "Reference Genome Selection",
  description:
    "Select a reference genome from the genome list or a FASTA file or a feature group. Only one reference is allowed.",
  sections: [
    {
      header: "Select a genome",
      description: "Type or select a genome name from the genome list.",
    },
    {
      header: "Or a FASTA file",
      description:
        "Select or upload an external genome file in protein FASTA format.",
    },
    {
      header: "Or a feature group",
      description:
        "Select a feature group from the workspace to show comparison of specific proteins instead of all proteins in a genome.",
    },
  ],
};

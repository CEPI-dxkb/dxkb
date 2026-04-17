import type { ServiceInfoPopup } from "@/types/services";

export const metaCATSInfo: ServiceInfoPopup = {
  title: "Meta-CATS Overview",
  description:
    "The meta-CATS metadata genome comparison tool takes sequence data and \
        determines the aligned positions that significantly differ between two (or more) user-specified groups. \
        Once an analysis is started, a multiple sequence alignment is performed if the input was unaligned (such as from a database query). \
        A chi-square test of independence is then performed on each non-conserved column of the alignment, to identify those that have a non-random distribution of bases. \
        A quantitative statistical value of variation is computed for all positions. Columns that are perfectly conserved will not be identified as statistically significant. \
        All other non-conserved columns will be evaluated to determine whether the p-value is lower than the specified threshold value. \
        Terminal gaps flanking the aligned sequences will not be taken into account for the analysis.",
};

export const metaCATSParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "P-value",
      description:
        "the probability of the observed data given that the null hypothesis is true.",
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description:
        "A user-specified label. This name will appear in the workspace when the analysis job is complete.",
    },
    {
      header: "Fasta Text Input",
      description:
        "Users may enter custom sequences here by pasting in FASTA formatted sequences.",
    },
  ],
};

export const metaCATSInput: ServiceInfoPopup = {
  title: "Input Options",
  description:
    "Auto Grouping: Allows users to group sequences by available metadata such as: host, country, year, virus type, host age, etc. The appropriate metadata field may be selected from the “METADATA” drop-down menu.",
  sections: [
    {
      header: "Auto Grouping",
      description:
        "Allows users to group sequences by available metadata such as: host, country, year, virus type, host age, etc. The appropriate metadata field may be selected from the “METADATA” drop-down menu.",
    },
    {
      header: "And/or Select Feature Group",
      description:
        "Users may input a nucleic acid or protein FASTA file containing a previously selected “Feature Group” (eg. CDS, tRNA etc.) from their workspace here, either in addition to the FASTA text input, or as an alternative.",
    },
    {
      header: "Metadata",
      description:
        "Auto grouping by available metadata options includes: Host name, geographic location, isolation country, species, genus, and collection year.",
    },
    {
      header: "Feature Groups",
      description:
        "This option allows users to select previously identified groups of sequences saved to their workspace.",
    },
    {
      header: "Alignment File",
      description:
        "This option allows users to select a previously aligned group of nucleotides or proteins.",
    },
    {
      header: "Select Feature Group",
      description:
        "This option allows users to specify feature groups previously saved to their workbench.",
    },
    {
      header: "DNA/PROTEIN",
      description:
        "Allows users to specify whether their sequences are nucleic acid or protein sequences.",
    },
    {
      header: "Group names",
      description: "User-specified names for custom groups.",
    },
    {
      header: "Delete Rows",
      description: "Allows users to delete unwanted sequences.",
    },
  ],
};

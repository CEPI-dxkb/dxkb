import type { ServiceInfoPopup } from "@/types/services";

export { readInputFileInfo } from "./common";

export const metagenomicReadMappingInfo: ServiceInfoPopup = {
  title: "Metagenomic Read Mapping Overview",
  description:
    "The Metagenomic Read Mapping Service uses <a href='https://bmcbioinformatics.biomedcentral.com/articles/10.1186/s12859-018-2336-6'>KMA</a> to align reads against antibiotic resistance genes, virulence factors, or other custom sets of genes.",
};

export const metagenomicReadMappingParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Predefined Gene Set Name",
      description:
        "A pre-built set of genes against which reads are mapped. Two options are available:",
      subsections: [
        {
          subheader: "CARD",
          subdescription:
            "Antibiotic resistence gene set from the <a href='https://www.ncbi.nlm.nih.gov/pubmed/27789705>Comprehensive Antibiotic Resistance Database</a>",
        },
        {
          subheader: "VFDB",
          subdescription:
            "Virulence factor gene set from the <a href='https://www.ncbi.nlm.nih.gov/pubmed/30395255>Virulence Factor Database</a>",
        },
      ],
    },
    {
      header: "Feature Group",
      description:
        "Reads can also be mapped to a previously created groups of features (genes or proteins). There are several ways to navigate to the feature group. Clicking on the drop-down box will show the feature groups, with the most recently created groups shown first. Clicking on the desired group will fill the box with that name.",
    },
    {
      header: "Fasta File",
      description:
        "Reads can be mapped to a fasta file describing an dna sequence. The file must be present in BV-BRC, which would be located by entering the name in the text box, clicking on the drop-down box, or navigating within the workspace. Inorder to select a file for this service the file type must be specified as one of our fasta types (aligned_dna_fasta, or feature_dna_fasta).",
    },
    {
      header: "Output Folder",
      description: "Workspace folder where the results will be saved.",
    },
    {
      header: "Output Name",
      description: "User-provided name used to uniquely identify results.",
    },
  ],
};

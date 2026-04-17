import type { ServiceInfoPopup } from "@/types/services";

export const phylogeneticTreeInfo: ServiceInfoPopup = {
  title: "Phylogenetic Tree Overview",
  description:
    "The BV-BRC Phylogenetic Tree Building Service enables construction of custom phylogenetic trees \
        built from user-selected genomes, genes, or proteins. Trees can be built based on either nucleotide or protein \
        input sequences. The “FastTree” option computes large minimum evolution trees with profiles instead of a distance matrix. \
        [1,2]. We also offer two maximum likelihood tree building algorithms: PhyML [3] and RaxML [4]. User-defined settings \
        are required for either. PhyML and RaxML infer a more evolutionarily accurate phylogenetic topology by applying a \
        substitution model to the nucleotide sequences. This algorithm is best applied to datasets containing \
        1. fewer than 100 very long sequences, and \
        2. between 100 and 1,000 small or medium length sequences. \
        The service returns a Newick file which can be rendered in the interactive Archaeopteryx Tree Viewer in the BV-BRC or downloaded and viewed in other software.",
};

export const phylogeneticTreeInput: ServiceInfoPopup = {
  title: "Comparison Genomes Selection",
  description:
    "The GeneTree Service allows selection of multiple genomes, genes, or proteins (features) for inclusion in the tree. After selection of an item in any of the boxes, clicking the “+” button adds the item to the “selected file/feature table” box below.",
  sections: [
    {
      header: "DNA/PROTEIN",
      description:
        "Selects either nucleotide or protein-based tree construction.",
    },
    {
      header: "DNA/protein aligned fasta",
      description:
        "Allows upload of aligned sequence fasta file from the user’s computer or workspace.",
    },
    {
      header: "Unaligned gene fasta",
      description:
        "Allows upload of unaligned sequence fasta file from the user’s computer or workspace.",
    },
    {
      header: "Feature group",
      description: "Allow selection of a feature group from the workspace.",
    },
    {
      header: "Genome group",
      description: "Allow selection of a genome group from the workspace.",
    },
    {
      header: "And/or select",
      description: "Allow selection of a genome group from the workspace.",
    },
    {
      header: "Selected file/feature table",
      description:
        "Lists all input sequences that will be included in the tree.",
    },
  ],
};

export const phylogeneticTreeAlignmentParameters: ServiceInfoPopup = {
  title: "Alignment Parameters",
  sections: [
    {
      header: "Trim ends of alignment threshold",
      description: "Sets threshold for trimming ends of the alignment.",
    },
    {
      header: "Remove gappy sequences threshold",
      description:
        "Sets threshold for removing gappy positions from alignment extremities.",
    },
  ],
};

export const phylogeneticTreeTreeParameters: ServiceInfoPopup = {
  title: "Tree Parameters",
  sections: [
    {
      header: "Tree algorithm",
      description:
        "Selects from among the following tree-building algorithms: RaxML, PhyML, or FastTree.",
    },
    {
      header: "Model",
      description:
        "Allows selection of the appropriate evolutionary model. Options will change based on whether user is aligning nucleotide or protein sequences:",
      subsections: [
        {
          subheader: "Nucleotide",
          subdescription: "HKY85, JC69, K80, F81, F84, TN93, GTR",
        },
        {
          subheader: "Protein",
          subdescription: "LG, WAG, JTT, Blosum62, Dayhoff, HIVw, HIVb",
        },
      ],
    },
    {
      header: "Output folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output name",
      description:
        "User-specified label for the results of the tree-buidling analysis job. This name will appear in the workspace when the job is complete.",
    },
  ],
};

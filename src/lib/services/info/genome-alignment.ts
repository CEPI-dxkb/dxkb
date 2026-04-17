import type { ServiceInfoPopup } from "@/types/services";

export const genomeAlignmentMauveInfo: ServiceInfoPopup = {
  title: "Genome Alignment (Mauve) Overview",
  description:
    "The bacterial Genome Alignment Service uses progressiveMauve to produce a whole genome alignment of two or more genomes. The resulting alignment can be visualized within the BV-BRC website, providing insight into homologous regions and changes due to DNA recombination. It should be noted that this service is currently released as beta. As always, we appreciate your feedback.",
};

export const genomeAlignmentSelectGenomes: ServiceInfoPopup = {
  title: "Select Genomes",
  description: "Specifies the genomes (at least 2) to have aligned.",
  sections: [
    {
      header: "Select Genomes",
      description:
        "Genomes for inclusion in the ingroup for the tree. Type or select a genome name from the genome list. Use the “+ Add” button to add to the Selected Genome Table.",
    },
    {
      header: "Or Select Genome Group",
      description:
        "Option for including a genome group from the workspace. Can be included with, or instead of, the Selected Genomes.",
    },
  ],
};

export const genomeAlignmentAdvancedParamaterOptions: ServiceInfoPopup = {
  title: "Advanced Parameter options",
  sections: [
    {
      header: "Manually set seed weight",
      description:
        "The seed size parameter sets the minimum weight of the seed pattern used to generate local multiple alignments (matches) during the first pass of anchoring the alignment. When aligning divergent genomes or aligning more genomes simultaneously, lower seed weights may provide better sensitivity. However, because Mauve also requires the matching seeds must to be unique in each genome, setting this value too low will reduce sensitivity.",
    },
    {
      header: "Weight",
      description:
        "Minimum pairwise LCB score, refers to the minimum score for Locally Collinear Blocks (LCBs) to be considered in the alignment. The LCB weight sets the minimum number of matching nucleotides identified in a collinear region for that region to be considered true homology versus random similarity. Mauve uses an algorithm called greedy breakpoint elimination to compute a set of Locally Collinear Blocks (LCBs) that have the given minimum weight. By default an LCB weight of 3 times the seed size will be used. The default value is often too low, however, and this value should be set manually.",
    },
  ],
};

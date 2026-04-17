import type { ServiceInfoPopup } from "@/types/services";

export const similarGenomeFinderInfo: ServiceInfoPopup = {
  title: "Similar Genome Finder Overview",
  description:
    "The bacterial Similar Genome Finder Service will find similar public genomes in BV-BRC or compute genome distance estimation using <a href='https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4915045/'>Mash/MinHash</a>. It returns a set of genomes matching the specified similarity criteria.",
};

export const similarGenomeFinderSelectGenome: ServiceInfoPopup = {
  title: "Select a Genome",
  description:
    "Specifies the genome to use as the basis for finding other similar genomes.",
  sections: [
    {
      header: "Search by Genome Name or Genome ID",
      description:
        "Selection box for specifying genome in BV-BRC to use as the basis of comparison.",
    },
    {
      header: "Or Upload FASTA",
      description:
        "Alternate option for uploading a FASTA file to use as the basis of comparison. Note: You must be logged into BV-BRC to use this option.",
    },
  ],
};

export const similarGenomeFinderAdvancedParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Max Hits",
      description: "The maximum number of matching genomes to return.",
    },
    {
      header: "P-Value Threshold",
      description:
        "Sets the maximum allowable p-value associated with the Mash Jaccard estimate used in calculating the distance.",
    },
    {
      header: "Distance",
      description:
        "Mash distance, which estimates the rate of sequence mutation under as simple evolutionary model using k-mers. The Distance parameter sets the maximum Mash distance to include in the Similar Genome Finder Service results. Mash distances are probabilistic estimates associated with p-values.",
    },
    {
      header: "Scope",
      description:
        "Option for limiting the search to only Reference and Representative genomes, or all genomes in BV-BRC.",
    },
  ],
};

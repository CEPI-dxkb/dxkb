import type { ServiceInfoPopup } from "@/types/services";

export const subspeciesClassificationInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The subspecies classification tool assigns the genotype/subtype of a virus, based on the genotype/subtype assignments \
    maintained by the International Committee on Taxonomy of Viruses (ICTV). This tool infers the genotype/subtype for a \
    query sequence from its position within a reference tree (using the pplacer tool with a reference tree and reference \
    alignment, including the query sequence as input, interpretation of the pplacer result is handled by Cladinator).",
};

export const subspeciesClassificationQuerySource: ServiceInfoPopup = {
  title: "Query Source",
  description:
    "Users may enter their input sequence in this box, either by directly pasting in a nucleotide sequence, or by selecting a FASTA file from the BV-BRC or uploading it to the site.",
  sections: [
    {
      header: "Enter Sequence",
      description:
        "Users may enter custom sequences here by pasting in FASTA formatted sequences.",
    },
    {
      header: "Select FASTA file",
      description: "Choose FASTA file that has been uploaded to the Workspace.",
    },
  ],
};

export const subspeciesClassificationSpeciesInfo: ServiceInfoPopup = {
  title: "Species",
  description:
    "Select the viral species desired for classification. Current species available for subspecies classification include: Hepatitis C Virus (HCV), Dengue Virus, Saint Louis Encephalitis Virus, West Nile Virus, Japanese Encephalitis Virus, tickborne Encephalitis Virus, Yellow Fever virus, Bovine diarrheal virus 1, Murray Valley Encephalitis virus, and Zika virus.",
};


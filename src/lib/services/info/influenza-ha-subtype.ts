import type { ServiceInfoPopup } from "@/types/services";

export const haSubtypeNumberingInput: ServiceInfoPopup = {
  title: "Input sequence",
  description:
    "Input sequences can be either a feature group, selected fasta sequence(s), or user-supplied sequence in fasta format.",
  sections: [
    {
      header: "Enter Sequence",
      description: "Allows pasting of a custom sequence in fasta format.",
    },
    {
      header: "Select FASTA File",
      description:
        "Allows selection of custom sequence(s) saved in the workspace.",
    },
    {
      header: "Feature Groups",
      description:
        "Allows selection of previously identified groups of sequences saved in the workspace.",
    },
  ],
};

export const haSubtypeNumberingConversionScheme: ServiceInfoPopup = {
  title: "Conversion Sequence Numbering Scheme",
  description:
    "Select one or more HA subtype numbering schemes to which your sequences will be converted. The service uses the Burke and Smith cross-subtype numbering scheme based on structurally equivalent positions across HA subtypes.",
};

import type { ServiceInfoPopup } from "@/types/services";

export { readInputFileInfo } from "./common";

export const sarsCov2GenomeAnalysisInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The SARS-CoV-2 Genome Assembly and Annotation Service provides a streamlined “meta-service” that accepts raw reads and performs genome assembly, annotation, and variation analysis for SARS-CoV-2 genome reads. The figure below provides an overview of the workflows of the service.",
};

export const sarsCov2GenomeAnalysisStartWith: ServiceInfoPopup = {
  title: "Start With",
  description:
    "The service can accept either read files or assembled contigs. If the “Read Files” option is selected, the Assembly Service will be invoked automatically to assemble the reads into contigs before invoking the Annotation Service. If the “Assembled Contigs” option is chosen, the Annotation Service will automatically be invoked, bypassing the Assembly Service.",
};

export const sarsCov2GenomeAnalysisParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Strategy",
      subsections: [
        {
          subheader: "One Codex",
          subdescription:
            "Uses the One Codex pipeline for SARS-CoV-2 assembly. When selected, Primers and Version can be specified (e.g. ARTIC, midnight, qiagen, swift, varskip).",
        },
        {
          subheader: "Auto",
          subdescription:
            "Uses CDC-Illumina or CDC-Nanopore protocol based on the type of reads provided (see below).",
        },
        {
          subheader: "CDC-Illumina",
          subdescription:
            "Implements CDC-prescribed assembly protocol for SARS-CoV-2 genome sequences for Illumina-generated sequences.",
        },
        {
          subheader: "CDC-Nanopore",
          subdescription:
            "Implements CDC-prescribed assembly protocol for SARS-CoV-2 genome sequences for Nanopore-generated sequences.",
        },
        {
          subheader: "ARTIC-Nanopore",
          subdescription:
            "Implements the ARTICnetwork-prescribed protocol for nCoV-19 genome sequences for Nanopore-generated sequences.",
        },
      ],
    },
    {
      header: "Primers and Version",
      description:
        "When Strategy is One Codex, select the primer set (e.g. ARTIC, midnight, qiagen, swift, varskip, varskip-long) and the corresponding version. These options are disabled for CDC-Illumina, CDC-Nanopore, and ARTIC-Nanopore strategies.",
    },
    {
      header: "Taxonomy ID",
      description:
        "Pre-populated with the appropriate taxonomy ID for SARS-CoV-2.",
    },
    {
      header: "My Label",
      description: "User-provided name to uniquely identify the results.",
    },
    {
      header: "Output Folder",
      description:
        "User-selected workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description:
        "Auto-generated name for the results (Taxonomy Name + My Label)",
    },
  ],
};

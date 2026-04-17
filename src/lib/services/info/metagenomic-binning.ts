import type { ServiceInfoPopup } from "@/types/services";

export const metagenomicBinningInfo: ServiceInfoPopup = {
  title: "Metagenomic Binning Overview",
  description:
    "The Metagenomic Binning Service accepts either reads or contigs, \
        and attempts to “bin” the data into a set of genomes. This service can be \
        used to reconstruct bacterial and archael genomes from environmental samples.",
};

export const metagenomicBinningStartWith: ServiceInfoPopup = {
  title: "Start With",
  description:
    "The service supports input of read files or assembled contigs. \
        This selection changes the options in the Input File box on the form.",
};

export const metagenomicBinningInputFile: ServiceInfoPopup = {
  title: "Input File",
  description:
    "The Input File box options depend on whether Read File or Assembled Contigs is chosen in the Start With box.",
  sections: [
    {
      header: "Read File Option",
      description:
        "Multiple read types can be uploaded and submitted to the service. Clicking the arrow beside each one after uploading the file moves it to the Selected Libraries box, which will all be included when the service is run.",
      subsections: [
        {
          subheader: "Paired Read Library - Read File 1 & 2",
          subdescription:
            "Many paired read libraries are given as file pairs, with each file containing half of each read pair. Paired read files are expected to be sorted such that each read in a pair occurs in the same Nth position as its mate in their respective files. These files are specified as READ FILE 1 and READ FILE 2. For a given file pair, the selection of which file is READ 1 and which is READ 2 does not matter.",
        },
        {
          subheader: "Single Read Library",
          subdescription:
            "This option allows upload of a fastq file that contains single reads.",
        },
        {
          subheader: "SRR Run Accession",
          subdescription:
            "This option allows upload of existing read data at the NCBI Sequence Read Archive (SRA) by entering the SRR Run Accession number.",
        },
      ],
    },
    {
      header: "Assembled Contigs Option",
      subsections: [
        {
          subheader: "Contigs",
          subdescription:
            "Alternatively, contigs can be uploaded and used with the service instead of read files.",
        },
      ],
    },
  ],
};

export const metagenomicBinningParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Assembly Strategy",
      description: "3 options are available for read assembly:",
      subsections: [
        {
          subheader: "MetaSpades [2]",
          subdescription:
            "Part of the SPAdes toolkit, developed to address the various challenges of metagenomic assembly.",
        },
        {
          subheader: "MEGAHIT [3]",
          subdescription:
            "A de novo assembler for assembling large and complex metagenomics data. MEGAHIT assembles the data as a whole (i.e., no preprocessing like partitioning and normalization).",
        },
        {
          subheader: "Auto",
          subdescription:
            "The service uses the most appropriate strategy for the input data.",
        },
      ],
    },
    {
      header: "Organisms of Interest",
      description:
        "This option allows selection of bacterial or viral annotation, or both.",
      subsections: [
        {
          subheader: "Bacteria/Archaea",
          subdescription: "Uses the RASTtk [4] annotation pipeline.",
        },
        {
          subheader: "Viruses",
          subdescription:
            "Uses use one of two annotation pipelines. It uses the VIGOR4 [5,6] pipeline if a reference annotation is available for that virus or viral family. If not, the Mat Peptide [7] pipeline is used.",
        },
        {
          subheader: "Both",
          subdescription:
            "Uses both the bacterial and viral annotation pipelines.",
        },
      ],
    },
    {
      header: "Output Folder",
      description:
        "The workspace folder where analysis job results will be placed.",
    },
    {
      header: "Output Name",
      description: "User-defined name used to uniquely identify results.",
    },
    {
      header: "Genome Group Name",
      description: "Name used to create genome group with identified genomes.",
    },
  ],
};

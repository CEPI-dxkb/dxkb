import type { ServiceInfoPopup } from "@/types/services";

export const readInputFileInfo: ServiceInfoPopup = {
  title: "Read Input File",
  description:
    "Upload your paired-end reads, single reads, or provide SRA accession numbers",
  sections: [
    {
      header: "Paired read library",
      subsections: [
        {
          subheader: "Read File 1 & 2",
          subdescription:
            "Many paired read libraries are given as file pairs, with each file containing half of each read pair. \
                    Paired read files are expected to be sorted such that each read in a pair occurs in the same Nth position as its mate in their respective files. \
                    These files are specified as READ FILE 1 and READ FILE 2. For a given file pair, the selection of which file is READ 1 and which is READ 2 does not matter.",
        },
      ],
    },
    {
      header: "Single read library",
      subsections: [
        {
          subheader: "Read File",
          subdescription: "The FASTQ file containing the reads.",
        },
      ],
    },
    {
      header: "SRA run accession",
      description:
        "Allows direct upload of read files from the <a href='https://www.ncbi.nlm.nih.gov/sra'>NCBI Sequence Read Archive</a> to the BV-BRC Assembly Service. \
                Entering the SRR accession number and clicking the arrow will add the file to the selected libraries box for use in the assembly.",
    },
  ],
};

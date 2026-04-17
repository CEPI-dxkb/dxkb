import type { ServiceInfoPopup } from "@/types/services";

export { readInputFileInfo } from "./common";

export const fastqUtilitiesInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The FastQ Utilities Service makes available common operations for FASTQ files from high throughput sequencing, including: generating FastQC reports of base call quality; aligning reads to genomes using Bowtie2 to generate BAM files, saving unmapped reads and generating SamStat reports of the amount and quality of alignments; and trimming of adapters and low quality sequences using TrimGalore and CutAdapt. The FastQ Utiliites app allows the user to define a pipeline of activities to be performed to designated FASTQ files. The three components (trim, fastqc and align) can be used independently, or in any combination.These actions happen in the order in which they are specified. In the case of trimming, the action will replace untrimmed read files with trimmed ones as the target for all subsequent actions. FASTQ reads (paired-or single-end, long or short, zipped or not), as well as Sequence Read Archive accession numbers are supported.",
};

export const fastqUtilitiesParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description: "User-provided name used to uniquely identify results.",
    },
  ],
};

export const fastqUtilitiesPipeline: ServiceInfoPopup = {
  title: "Pipeline",
  sections: [
    {
      header: "Select Action",
      description:
        "Dropdown box with options for specifying the steps for processing the reads. Each step can be added in any desired order",
      subsections: [
        {
          subheader: "Trim",
          subdescription:
            "Uses Trim Galore to find and remove adapters, leaving the relevant part of the read.",
        },
        {
          subheader: "Fastqc",
          subdescription:
            "Uses FastQC to do quality checks on the raw sequence data.",
        },
        {
          subheader: "Align",
          subdescription:
            "Aligns genomes using Bowtie2 to generate BAM files, saving unmapped reads, and generating SamStat reports of the amount and quality of alignments.",
        },
        {
          subheader: "Paired Filter",
          subdescription:
            "Many downstream bioinformatics manipulations break the one-to-one correspondence between reads, and paired-end sequence files loose synchronicity, and contain either unordered sequences or sequences in one or other file without a mate. The Paired Filter will ensure the reads being evenly matched, so the FASTQ Utilities service now offers a pipeline that ensures that all paired-end reads have a match. The pipeline uses Fastq-Pair[4]. The code for Fastq-Pair is available here: https://github.com/linsalrob/fastq-pair.",
        },
      ],
    },
  ],
};

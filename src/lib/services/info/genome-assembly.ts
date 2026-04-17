import type { ServiceInfoPopup } from "@/types/services";

export { readInputFileInfo } from "./common";

export const genomeAssemblyInfo: ServiceInfoPopup = {
  title: "Genome Assembly Overview",
  description:
    "The bacterial Genome Assembly Service allows single or multiple assemblers to be invoked to compare results. Several assembly workflows or “strategies” are available that have been tuned to fit certain data types or desired analysis criteria such as throughput or rigor. Once the assembly process has started by clicking the Assemble button, the genome is queued as a “job” for the Assembly Service to process, and will increment the count in the Jobs information box on the bottom right of the page. Once the assembly job has successfully completed, the output file will appear in the workspace, available for use in the BV-BRC comparative tools and downloaded if desired.",
};

export const genomeAssemblyParameters: ServiceInfoPopup = {
  title: "Parameter Options",
  sections: [
    {
      header: "Assembly Strategy",
      subsections: [
        {
          subheader: "Auto",
          subdescription:
            "Will use Canu if only long reads are submitted. If long and short reads, as or short reads alone are submitted, Unicycler is selected.",
        },
        {
          subheader: "Unicycler",
          subdescription:
            "Can assemble Illumina-only read sets where it functions as a SPAdes-optimizer. It can also assembly long-read-only sets (PacBio or Nanopore) where it runs a miniasm plus Racon pipeline. For the best possible assemblies, give it both Illumina reads and long reads, and it will conduct a hybrid assembly.",
        },
        {
          subheader: "SPAdes",
          subdescription:
            "Designed to assemble small genomes, such as those from bacteria, and uses a multi-sized De Bruijn graph to guide assembly.",
        },
        {
          subheader: "Canu",
          subdescription:
            "Long-read assembler which works on both third and fourth generation reads. It is a successor of the old Celera Assembler that is specifically designed for noisy single-molecule sequences. It supports nanopore sequencing, halves depth-of-coverage requirements, and improves assembly continuity. It was designed for high-noise single-molecule sequencing (such as the PacBio RS II/Sequel or Oxford Nanopore MinION).",
        },
        {
          subheader: "metaSPAdes",
          subdescription:
            "Combines new algorithmic ideas with proven solutions from the SPAdes toolkit to address various challenges of metagenomic assembly.",
        },
        {
          subheader: "plasmidSPAdes",
          subdescription:
            "For assembling plasmids from whole genome sequencing data and benchmark its performance on a diverse set of bacterial genomes.",
        },
        {
          subheader: "MDA (single-cell)",
          subdescription:
            "A new assembler for both single-cell and standard (multicell) assembly, and it improves on the recently released E+V−SC assembler (specialized for single-cell data).",
        },
      ],
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description: "User-provided name used to uniquely identify results.",
    },
    {
      header: "Benchmark Contigs",
      description:
        "This optional parameter can be used to specify a FASTA contigs file to evaluate the assembly against.",
    },
    {
      header: "Advanced",
      description:
        "Trim reads before assembly: Trim reads using TrimGalore (True/False)",
      subsections: [
        {
          subheader: "Racon iternations and Pilon iterations",
          subdescription:
            "Correct assembly errors (or “polish”) using racon and/or Pilon. \
                        Both racon and Pilon take the contigs and the reads mapped to those contigs, and look for discrepancies between the assembly \
                        and the majority of the reads. Where there is a discrepancy, racon or pilon will correct the assembly if the majority of the reads call for that.",
        },
        {
          subheader: "Minimal output contig length",
          subdescription: "Filter out short contigs in final assembly",
        },
        {
          subheader: "Minimal output contig coverage",
          subdescription:
            "Filter out contigs with low read depth in final assembly",
        },
      ],
    },
  ],
};

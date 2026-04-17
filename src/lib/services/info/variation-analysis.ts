import type { ServiceInfoPopup } from "@/types/services";

export { readInputFileInfo } from "./common";

export const variationAnalysisInfo: ServiceInfoPopup = {
  title: "Variation Analysis Overview",
  description:
    "The Variation Analysis Service can be used to identify and annotate sequence variations. \
        The service enables users to upload one or multiple short read samples and compare them to a closely related \
        reference genome. For each sample, the service computes the variations against the reference and presents a detailed list of SNPs, \
        MNPs, insertions and deletions with confidence scores and effects such as “synonymous mutation” and “frameshift.” \
        High confidence variations are downloadable in the standard VCF format augmented by SNP annotation. \
        A summary table illustrating how the variations are shared across the samples is also available.",
};

export const variationAnalysisParameters: ServiceInfoPopup = {
  title: "Variation Analysis Parameters",
  sections: [
    {
      header: "Aligner",
      subsections: [
        {
          subheader: "BWA-mem",
          subdescription:
            "BWA-mem is well-rounded aligner for mapping short sequence reads or long query sequences against a large reference genome. It automatically chooses between local and end-to-end alignments, supports paired-end reads and performs chimeric alignment. The algorithm is robust to sequencing errors and applicable to a wide range of sequence lengths from 70bp to a few megabases.",
        },
        {
          subheader: "BWA-mem-strict",
          subdescription:
            "BWA-mem-strict is BWA-mem with the default parameters plus “-B9 -O16” to increase the gap extension and clipping penalty. These strict mapping parameters are recommended for cases where contigs and references are known to be very close to each other.",
        },
        {
          subheader: "Bowtie2",
          subdescription:
            "Bowtie2 is an aligner that combines the advantages of the full-text minute index and SIMD dynamic programming, achieves very fast and memory-efficient gapped alignment of sequencing reads. It improves on the previous Bowtie method in terms of speed and fraction of reads aligned and is substantially faster than non-“full-text minute index“-based approaches while aligning a comparable fraction of reads. Bowtie 2 performs sensitive gapped alignment without incurring serious computational penalties.",
        },
        {
          subheader: "LAST",
          subdescription:
            "LAST can handle big sequence data, like comparing two vertebrate genomes. It can align billions of DNA reads to a genome, and will indicate reliability of each aligned column. In addition, it can compare DNA to proteins, with frameshifts, compare PSSMs to sequences, calculates the likelihood of chance similarities between random sequences, does split and spliced alignment, and can be trained for unusual kinds of sequences (like nanopore).",
        },
        {
          subheader: "minimap2",
          subdescription:
            "minimap2 is a versatile sequence mapping and alignment program for the most popular long read sequencing platforms like Oxford Nanopore Technologies (ONT) and Pacific Biosciences (PacBio). It is very fast and accurate compared to other long-read mappers. minimap2 works efficiently with query sequences from a few kilobases to ~100 megabases in length at an error rate ~15%. It also works with accurate short reads of ≥100 bp in length. Currently, this option uses minimap2 default parameters.",
        },
      ],
    },
    {
      header: "SNP Caller",
      subsections: [
        {
          subheader: "FreeBayes",
          subdescription:
            "FreeBayes is an accurate method for sequence organization that includes fragment clustering, paralogue identification and multiple alignment. It calculates the probability that a given site is polymorphic and has an automated evaluation of the full length of all sequences, without limitations on alignment depth.",
        },
        {
          subheader: "BCFtools",
          subdescription:
            "BCFtools implements various utilities that manipulate variant calls in the Variant Call Format (VCF) and its binary counterpart BCF. This option invokes the BCFtools’ SNP calling algorithm on top of BCFtools’ mpileup result.",
        },
      ],
    },
    {
      header: "Target Genome",
      description:
        "A target genome to align the reads against. If this genome is a private genome, the search can be narrowed by clicking on the filter icon under the words Target Genome.",
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description: "Name used to uniquely identify results.",
    },
  ],
};

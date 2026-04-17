import type { ServiceInfoPopup } from "@/types/services";

export const taxonomyClassificationInfo: ServiceInfoPopup = {
  title: "Taxonomy Classification Overview",
  description:
    "The Taxonomic Classification Service accepts reads or SRR values from sequencing of a metagenomic sample and uses \
        <a href='http://genomebiology.com/2014/15/3/R46'>Kraken 2</a> to assign the reads to taxonomic bins, providing an initial profile of the possible constituent organisms present in the sample. \
        We support taxonomic classification for whole genome sequencing data (WGS) and for 16s rRNA sequencing. \
        It is important that you select the sequence type. Then the analysis options and database options will change support your sequence type.",
};

export const taxonomyClassificationInput: ServiceInfoPopup = {
  title: "Input File",
  description:
    "This service is designed to process short reads. This can be via single read files, paired read files or the SRA run accession.",
};

export const taxonomyClassificationParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Analysis Type",
      description:
        "We now support 16S and Whole Genome Sequencing (WGS). \
                The Analysis type and database options will change according to which sequencing type is chosen.",
    },
  ],
};

export const taxonomyClassificationAnalysisType: ServiceInfoPopup = {
  title: "Analysis Type",
  description:
    "See tutorial for a detailed explaination of each analysis type.",
  sections: [
    {
      header: "Whole Genome Sequencing (WGS)",
      description:
        "The WGS pipelines are described in Lu et al., 2022. The FASTQ processing is the same for both the Species Identification and Microbiome Pipeline. FastQC is performed on the raw FASTQ files. If a host is chosen in the Filter Host Reads dropdown, Hisat2 will align the reads to the host genome then remove any aligned reads that aligned to the host genome from the sample. FastQC will run on the host removed reads. Then the host removed reads are used in the Kraken2 command.",
    },
    {
      header: "Species Identification (WGS)",
      description:
        "The Species identification is an end-to-end pipeline that runs Kraken2Uniq to identify taxa at the species level. The Kraken results are used in the analysis results.",
    },
    {
      header: "Microbiome Analysis (WGS)",
      description:
        "The Microbiome analysis is an end-to-end pipeline that is similar to the Species Identification Pipeline. This pipeline uses Kraken2 to identify taxa the species level. However, this pipeline uses a companion program to Kraken2 and the other tools in the Kraken suite, Bracken. Bracken is run at the species level with the flag ‘-S’. Bracken recreates the report file using the values from the Bracken recalculation.",
    },
    {
      header: "16S rRNA Analysis",
      description:
        "16S rRNA Analysis with Kraken2 is described in Lu et al., 2020. Currently, we offer one analysis type for 16S that is very similar to the WGS microbiome analysis with a few differences. The most important differences are the database options.",
    },
    {
      header: "16S rRNA FASTQ Processing",
      description:
        "The FASTQ processing begins with FastQC on the raw FASTQ files. Then the reads are trimmed with Trim Galore. Trim Galore is a wrapper around the tool Cutadapt and FastQC to apply quality and adapter trimming of FASTQ files. FastQC results will be available for the trimmed reads. The FastQC results are available under the sample directory in the FastQC_results directory. The results are also compiled into a MultiQC report. The trimmed reads are used in the Kraken2 command.",
    },
    {
      header: "16S rRNA Default Analysis",
      description:
        "This pipeline uses a companion program to Kraken2 and the other tools in the Kraken suite, Bracken. Bracken is run at the genus level with the flag ‘-G’. The SILVA and Greengenes database offer reliable results to the genus level. The databases offer some taxa at lower taxonomy levels. But too few to reliably generate the Bracken report. Bracken recreates the report file using the values from the Bracken recalculation. This is available in the user input sample id subdirectory under bracken_output. Any levels whose reads were below the threshold of 10 are not included. Percentages will be re-calculated for the remaining levels. Unclassified reads are not included in the report. The Bracken results are used the Krona and Sankey plots. Bracken functions calculate alpha and beta diversity.",
    },
    {
      header: "All Analysis Types",
      description:
        "All analysis types use Kraken 2 assigns taxonomic labels to metagenomic DNA sequences using exact alignment of k-mers. Kraken 2 source code A MultiQC report will generate with the FastQC results and kraken results. If multiple samples are submitted, an interactive multisample comparison table is generated from the Kraken results.",
    },
  ],
};

export const taxonomyClassificationDatabase: ServiceInfoPopup = {
  title: "Database",
  description: "Reference taxonomic database used by the Kraken2.",
  sections: [
    {
      header: "Whole genome sequencing databases (WGS)",
      description:
        "Standard Kraken 2 database containing distinct 31-mers, based on completed microbial genomes from NCBI.",
    },
    {
      header: "BV-BRC Database",
      description:
        "The default Kraken 2 database at BV-BRC includes the RefSeq complete genomes and protein/nucleotide sequences for the following: Archaea, Bacteria, Plasmid, Viral, Human GRCh38, Fungi, Plant, Protozoa, UniVec: NCBI-supplied database of vector, adapter, linker, and primer sequences that may be contaminating sequencing projects and/or assemblies.",
    },
    {
      header: "16s Analysis databases SILVA",
      description:
        "The SILVA Database includes 16S rRNA genes sequences from bacteria, archaea, and eukaryotes.",
    },
    {
      header: "Greengenes",
      description:
        "Greengenes includes 16S rRNA gene sequences from bacteria and archaea.",
    },
  ],
};

export const taxonomyClassificationFilterHostReads: ServiceInfoPopup = {
  title: "Filter Host Reads",
  description:
    "If a host is chosen in the Filter Host Reads dropdown, Hisat2 will \
        align the reads to the host genome then remove any aligned reads that aligned to the host genome from the sample. \
        FastQC will run on the host removed reads. Then the host removed reads are used in the Kraken2 command.",
};

export const taxonomyClassificatioConfidenceInterval: ServiceInfoPopup = {
  title: "Confidence Interval",
  description:
    "The default confidence interval is 0.1. The classifier then will adjust labels up the tree until the label’s score meets or exceeds that threshold.",
};

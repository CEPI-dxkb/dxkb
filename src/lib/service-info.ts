import { ServiceInfoPopup } from "@/types/services";

// ------------------------------------------------ //
// ------------- Generic Service Info ------------- //
// ------------------------------------------------ //
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

// ---------------------------------------------- //
// ------------- BLAST Service Info ------------- //
// ---------------------------------------------- //
export const blastServiceInfo: ServiceInfoPopup = {
  title: "BLAST Overview",
  description:
    "The BLAST service integrates the BLAST (Basic Local Aligment Search Tool) algorithms to perform searches against against public or private genomes in BV-BRC or other reference databases using a DNA or protein sequence and find matching genomes, genes, RNAs, or proteins.",
};

export const blastServiceSearchProgram: ServiceInfoPopup = {
  title: "Search Program",
  description:
    "There are four BLAST programs provided by BV-BRC, and each has a specific query sequence and database. Clicking on the button in front of the program name will select it and will also select the appropriate databases.",
  sections: [
    {
      header: "BLASTN",
      description:
        "The query sequence is DNA (nucleotide), and when enabled the program will search against DNA databases of contig or gene sequences.",
    },
    {
      header: "BLASTX",
      description:
        "The query sequence is DNA (nucleotide), and when enabled the program will search against the protein sequence database.",
    },
    {
      header: "BLASTP",
      description:
        "The query sequence is protein (amino acid), and when enabled the program will search against the protein sequence database.",
    },
    {
      header: "tBLASTn",
      description:
        "The query sequence is protein (amino acid), and when enabled the program will search against DNA databases of contig or gene sequences.",
    },
  ],
};

export const blastServiceQuerySource: ServiceInfoPopup = {
  title: "Query Source",
  description:
    "There are three types of Query sources that are provided by BV-BRC:",
  sections: [
    {
      header: "Enter sequence",
      description: "Paste the query sequence into the box.",
    },
    {
      header: "Select FASTA file",
      description: "Choose FASTA file that has been uploaded to the Workspace.",
    },
    {
      header: "Select feature group",
      description:
        "Choose a feature (gene/protein) that has been saved in the Workspace.",
    },
  ],
};

export const blastServiceDatabaseSource: ServiceInfoPopup = {
  title: "Database Source",
  description:
    "DXKB / BV-BRC have different databases to choose from for the source to search wihin:",
  sections: [
    {
      header: "Reference and representative genomes (bacteria, archaea)",
      description: "Those designated by the NCBI. This is the default.",
    },
    {
      header: "Reference and representative genomes (virus)",
      description: "Those designated by the NCBI.",
    },
    {
      header: "Selected genome list",
      description:
        "Clicking on 'Search within genome list' in the drop-down box will open a new source box where desired genomes can be added.",
    },
    {
      header: "Selected genome group",
      description: "Genome group saved in the Workspace.",
    },
    {
      header: "Selected feature group",
      description: "Feature (gene/protein) group saved in the workspace.",
    },
    {
      header: "Taxon",
      description: "Selected taxonomic level from the database.",
    },
    {
      header: "Selected fasta file",
      description: "FASTA file that has been uploaded to the Workspace.",
    },
  ],
};

export const blastServiceDatabaseType: ServiceInfoPopup = {
  title: "Database Type",
  description: "There are three database types:",
  sections: [
    {
      header: "Genome Sequences (NT)",
      description:
        "Genomic sequences from bacterial and viral genomes in DXKB / BV-BRC, i.e. chromosomes, contigs, plasmids, segments, and partial genomic sequences",
    },
    {
      header: "Genes (NT)",
      description:
        "Gene sequences from bacterial and viral genomes in DXKB / BV-BRC.",
    },
    {
      header: "Proteins (AA)",
      description:
        "Protein sequences from bacterial and viral genomes in DXKB / BV-BRC.",
    },
  ],
};

// ----------------------------------------------------------------- //
// ------------- Genome Alignment (Mauve) Service Info ------------- //
// ----------------------------------------------------------------- //
export const genomeAlignmentMauveInfo: ServiceInfoPopup = {
  title: "Genome Alignment (Mauve) Overview",
  description:
    "The bacterial Genome Alignment Service uses progressiveMauve to produce a whole genome alignment of two or more genomes. The resulting alignment can be visualized within the BV-BRC website, providing insight into homologous regions and changes due to DNA recombination. It should be noted that this service is currently released as beta. As always, we appreciate your feedback.",
};

export const genomeAlignmentSelectGenomes: ServiceInfoPopup = {
  title: "Select Genomes",
  description: "Specifies the genomes (at least 2) to have aligned.",
  sections: [
    {
      header: "Select Genomes",
      description:
        "Genomes for inclusion in the ingroup for the tree. Type or select a genome name from the genome list. Use the “+ Add” button to add to the Selected Genome Table.",
    },
    {
      header: "Or Select Genome Group",
      description:
        "Option for including a genome group from the workspace. Can be included with, or instead of, the Selected Genomes.",
    },
  ],
};

export const genomeAlignmentAdvancedParamaterOptions: ServiceInfoPopup = {
  title: "Advanced Parameter options",
  sections: [
    {
      header: "Manually set seed weight",
      description:
        "The seed size parameter sets the minimum weight of the seed pattern used to generate local multiple alignments (matches) during the first pass of anchoring the alignment. When aligning divergent genomes or aligning more genomes simultaneously, lower seed weights may provide better sensitivity. However, because Mauve also requires the matching seeds must to be unique in each genome, setting this value too low will reduce sensitivity.",
    },
    {
      header: "Weight",
      description:
        "Minimum pairwise LCB score, refers to the minimum score for Locally Collinear Blocks (LCBs) to be considered in the alignment. The LCB weight sets the minimum number of matching nucleotides identified in a collinear region for that region to be considered true homology versus random similarity. Mauve uses an algorithm called greedy breakpoint elimination to compute a set of Locally Collinear Blocks (LCBs) that have the given minimum weight. By default an LCB weight of 3 times the seed size will be used. The default value is often too low, however, and this value should be set manually.",
    },
  ],
};

// ------------------------------------------------------------ //
// ------------- Genome Annotation Service Info ------------- //
// ------------------------------------------------------------ //
// TODO: Fix embedded links support in the Pop-up
export const genomeAnnotationInfo: ServiceInfoPopup = {
  title: "Genome Annotation Overview",
  description:
    "The Genome Annotation Service uses the RAST tool kit, <a href='https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4322359/'>RASTtk</a>, for bacteria and the <a href='https://github.com/JCVenterInstitute/VIGOR4'>Viral Genome ORF Reader (VIGOR4)</a> for viruses. \
    The service accepts a FASTA formatted contig file and an annotation recipe based on taxonomy to provide an annotated genome, to provide annotation of genomic features. \
    Once the annotation process has started by clicking the “Annotate” button, the genome is queued as a “job” for the Annotation Service to process, and will increment the count in the Jobs information box \
    on the bottom right of the page. Once the annotation job has successfully completed, the output file will appear in the workspace, available for use in the BV-BRC comparative tools and/or can be downloaded if desired.",
};

export const genomeAnnotationParameters: ServiceInfoPopup = {
  title: "Genome Annotation Parameters",
  sections: [
    {
      header: "Contigs",
      description:
        "The target FASTA file containing the genome sequence to annotate.",
    },
    {
      header: "Annotation Recipe",
      description:
        "The method of annotation, which will be determined by the type of microorganism chosen. Note: You MUST select this or jobs may fail.",
    },
    {
      header: "Domain",
      description:
        "The taxonomic domain of the target organism: bacteria or archaea.",
    },
    {
      header: "Taxonomy Name",
      description:
        "The user-entered or selected taxonomic name for the organism. If the target species or strain is not listed, select the most specific, accurate taxonomic level available.",
    },
    {
      header: "Taxonomy ID",
      description:
        "A unique numerical identifier assigned by the NCBI to the source organism of the protein.",
    },
    {
      header: "My Label",
      description: "The user-provided name to identify the annotation result.",
    },
    {
      header: "Output Name",
      description:
        "The taxonomy name concatenated with the chosen label. This name will appear in the workspace when the annotation job is complete.",
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
  ],
};

// -------------------------------------------------------- //
// ------------- Genome Assembly Service Info ------------- //
// -------------------------------------------------------- //
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

// ------------------------------------------------------ //
// ------------- Primer Design Service Info ------------- //
// ------------------------------------------------------ //
export const primerDesignInfo: ServiceInfoPopup = {
  title: "Primer Design Overview",
  description:
    "The Primer Design Service utilizes Primer3[1-5] to design primers from a given input \
        sequence under a variety of temperature, size, and concentration constraints. Primer3 can be used to design primers \
        for several uses including, PCR (Polymerase Chain Reaction) primers, hybridization probes, and sequencing primers. \
        The service accepts a nucleotide sequence (pasted in, or select a FASTA formatted file from the workspace) \
        and allows users to specify design. After specifying an appropriate output folder and clicking “submit”, \
        the primer design is queued as a “job” to process in the Jobs information box on the bottom right of the page. \
        Once the job has successfully completed, the output file will appear in the workspace, allowing the user to choose from a list of appropriate primers.",
};

export const primerDesignInputSequence: ServiceInfoPopup = {
  title: "Input Sequence",
  description: "Users may select one of two input options.",
  sections: [
    {
      header: "Pasting in a relevant sequence",
      subsections: [
        {
          subheader: "Sequence Identifier",
          subdescription:
            "The user-provided name to identify the input sequence. If using a FASTA formatted file, this field will automatically be populated with the sequence name.",
        },
        {
          subheader: "Paste Sequence",
          subdescription:
            "Choosing this option allows users to paste in an input sequence.",
        },
      ],
    },
    {
      header: "Choosing a workspace sequence",
      subsections: [
        {
          subheader: "Workspace FASTA",
          subdescription:
            "Choosing this option allows users to specify the FASTA file from their workspace. \
                        Users will also need to select appropriate target, inclusion and exclusion positions using options shown below. \
                        Selections can either be denoted by highlighting the desired regions and clicking the appropriate buttons (red box), \
                        or by manually typing in a list of coordinates in the appropriate boxes below. \
                        If you would like to design a hybridization probe to detect the PCR product after amplification (real-time PCR applications) you may select the “PICK INTERNAL OLIGO” option as shown above.",
        },
        {
          subheader: "Excluded Regions",
          subdescription:
            "Values should be one or a space-separated list of start, length pairs. Primers will not overlap these regions. These values will be denoted with “< >” symbols.",
        },
        {
          subheader: "Targets",
          subdescription:
            "Values should be one or a space-separated list of start, length pairs. Primers will flank one or more regions. These values will be denoted with “[ ]” symbols.",
        },
        {
          subheader: "Included Regions",
          subdescription:
            "Values should be a single start, length pair. Primers will be picked within this range. These values will be denoted with “{ }” symbols.",
        },
        {
          subheader: "Primer Overlap Positions",
          subdescription:
            "Values should be space separated list of positions, The forward OR reverse primer will overlap one of these positions. These values will be denoted with “-” symbol.",
        },
      ],
    },
  ],
};

// -------------------------------------------------------------- //
// ------------- Similar Genome Finder Service Info ------------- //
// -------------------------------------------------------------- //
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

// ------------------------------------------------------------ //
// ------------- Variation Analysis Service Info ------------- //
// ------------------------------------------------------------ //
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

// --------------------------------------------------------------------------- //
// ------------- Gene / Protein & Viral Genome Tree Service Info ------------- //
// --------------------------------------------------------------------------- //
export const phylogeneticTreeInfo: ServiceInfoPopup = {
  title: "Phylogenetic Tree Overview",
  description:
    "The BV-BRC Phylogenetic Tree Building Service enables construction of custom phylogenetic trees \
        built from user-selected genomes, genes, or proteins. Trees can be built based on either nucleotide or protein \
        input sequences. The “FastTree” option computes large minimum evolution trees with profiles instead of a distance matrix. \
        [1,2]. We also offer two maximum likelihood tree building algorithms: PhyML [3] and RaxML [4]. User-defined settings \
        are required for either. PhyML and RaxML infer a more evolutionarily accurate phylogenetic topology by applying a \
        substitution model to the nucleotide sequences. This algorithm is best applied to datasets containing \
        1. fewer than 100 very long sequences, and \
        2. between 100 and 1,000 small or medium length sequences. \
        The service returns a Newick file which can be rendered in the interactive Archaeopteryx Tree Viewer in the BV-BRC or downloaded and viewed in other software.",
};

export const phylogeneticTreeInput: ServiceInfoPopup = {
  title: "Comparison Genomes Selection",
  description:
    "The GeneTree Service allows selection of multiple genomes, genes, or proteins (features) for inclusion in the tree. After selection of an item in any of the boxes, clicking the “+” button adds the item to the “selected file/feature table” box below.",
  sections: [
    {
      header: "DNA/PROTEIN",
      description:
        "Selects either nucleotide or protein-based tree construction.",
    },
    {
      header: "DNA/protein aligned fasta",
      description:
        "Allows upload of aligned sequence fasta file from the user’s computer or workspace.",
    },
    {
      header: "Unaligned gene fasta",
      description:
        "Allows upload of unaligned sequence fasta file from the user’s computer or workspace.",
    },
    {
      header: "Feature group",
      description: "Allow selection of a feature group from the workspace.",
    },
    {
      header: "Genome group",
      description: "Allow selection of a genome group from the workspace.",
    },
    {
      header: "And/or select",
      description: "Allow selection of a genome group from the workspace.",
    },
    {
      header: "Selected file/feature table",
      description:
        "Lists all input sequences that will be included in the tree.",
    },
  ],
};

export const phylogeneticTreeAlignmentParameters: ServiceInfoPopup = {
  title: "Alignment Parameters",
  sections: [
    {
      header: "Trim ends of alignment threshold",
      description: "Sets threshold for trimming ends of the alignment.",
    },
    {
      header: "Remove gappy sequences threshold",
      description:
        "Sets threshold for removing gappy positions from alignment extremities.",
    },
  ],
};

export const phylogeneticTreeTreeParameters: ServiceInfoPopup = {
  title: "Tree Parameters",
  sections: [
    {
      header: "Tree algorithm",
      description:
        "Selects from among the following tree-building algorithms: RaxML, PhyML, or FastTree.",
    },
    {
      header: "Model",
      description:
        "Allows selection of the appropriate evolutionary model. Options will change based on whether user is aligning nucleotide or protein sequences:",
      subsections: [
        {
          subheader: "Nucleotide",
          subdescription: "HKY85, JC69, K80, F81, F84, TN93, GTR",
        },
        {
          subheader: "Protein",
          subdescription: "LG, WAG, JTT, Blosum62, Dayhoff, HIVw, HIVb",
        },
      ],
    },
    {
      header: "Output folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output name",
      description:
        "User-specified label for the results of the tree-buidling analysis job. This name will appear in the workspace when the job is complete.",
    },
  ],
};

// -------------------------------------------------- //
// ------------- MSA & SNP Service Info ------------- //
// -------------------------------------------------- //
export const msaSNPAnalysisInfo: ServiceInfoPopup = {
  title: "Multiple Sequence Alignment and SNP / Variation Analysis Overview",
  description:
    "The Multiple Sequence Alignment (MSA) and Single Nucleotide Polymorphism (SNP)/Variation Analysis Service \
        allows users to choose an alignment algorithm to align sequences selected from: a search result, a FASTA file saved to the workspace, \
        or through simply cutting and pasting. The service can also be used for variation and SNP analysis with feature groups, FASTA files, \
        aligned FASTA files, and user input FASTA records. If a single alignment file is given, then only the variation analysis is run. \
        If multiple inputs are given, the program concatenates all sequence records and aligns them. If a mixture of protein and nucleotides \
        are given, then nucleotides are converted to proteins.",
};

export const msaSNPAnalysisStartWith: ServiceInfoPopup = {
  title: "Start with",
  description: "Choose either",
  sections: [
    {
      header: "Unaligned sequences",
      description: "Set of sequences, not previously aligned.",
    },
    {
      header: "Aligned sequences",
      description: "Pre-aligned set of sequences",
    },
  ],
};

export const msaSNPAnalysisSelectSequences: ServiceInfoPopup = {
  title: "Comparison sequences",
  description: "Choose one of the following options:",
  sections: [
    {
      header: "Select Feature Group",
      description:
        "Users may input a nucleic acid or protein FASTA file containing a previously selected “Feature Group” (eg. CDS, tRNA etc.) from their workspace here, either in addition to the FASTA text input, or as an alternative. Choose either DNA or protein sequences.",
    },
    {
      header: "Select DNA or Protein FASTA File",
      description:
        "Users may input a nucleic acid or protein FASTA file from their workspace or upload their own data here, either in addition to the FASTA text input, or as an alternative.",
    },
    {
      header: "Input FASTA sequence",
      description:
        "Users may enter custom sequences here by pasting in FASTA formatted sequences.",
    },
  ],
};

export const msaSNPAnalysisParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Aligner",
      description: "Choose one of the aligmnent algorithm options:",
      subsections: [
        {
          subheader: "Mafft (default)",
        },
        {
          subheader: "MUSCLE",
        },
      ],
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description:
        "A user-specified label. This name will appear in the workspace when the annotation job is complete.",
    },
  ],
};

// ------------------------------------------------------------ //
// ------------- Meta-CATS Service Info ------------- //
// ------------------------------------------------------------ //
export const metaCATSInfo: ServiceInfoPopup = {
  title: "Meta-CATS Overview",
  description:
    "The meta-CATS metadata genome comparison tool takes sequence data and \
        determines the aligned positions that significantly differ between two (or more) user-specified groups. \
        Once an analysis is started, a multiple sequence alignment is performed if the input was unaligned (such as from a database query). \
        A chi-square test of independence is then performed on each non-conserved column of the alignment, to identify those that have a non-random distribution of bases. \
        A quantitative statistical value of variation is computed for all positions. Columns that are perfectly conserved will not be identified as statistically significant. \
        All other non-conserved columns will be evaluated to determine whether the p-value is lower than the specified threshold value. \
        Terminal gaps flanking the aligned sequences will not be taken into account for the analysis.",
};

export const metaCATSParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "P-value",
      description:
        "the probability of the observed data given that the null hypothesis is true.",
    },
    {
      header: "Output Folder",
      description: "The workspace folder where results will be placed.",
    },
    {
      header: "Output Name",
      description:
        "A user-specified label. This name will appear in the workspace when the analysis job is complete.",
    },
    {
      header: "Fasta Text Input",
      description:
        "Users may enter custom sequences here by pasting in FASTA formatted sequences.",
    },
  ],
};

export const metaCATSInput: ServiceInfoPopup = {
  title: "Input Options",
  description:
    "Auto Grouping: Allows users to group sequences by available metadata such as: host, country, year, virus type, host age, etc. The appropriate metadata field may be selected from the “METADATA” drop-down menu.",
  sections: [
    {
      header: "Auto Grouping",
      description:
        "Allows users to group sequences by available metadata such as: host, country, year, virus type, host age, etc. The appropriate metadata field may be selected from the “METADATA” drop-down menu.",
    },
    {
      header: "And/or Select Feature Group",
      description:
        "Users may input a nucleic acid or protein FASTA file containing a previously selected “Feature Group” (eg. CDS, tRNA etc.) from their workspace here, either in addition to the FASTA text input, or as an alternative.",
    },
    {
      header: "Metadata",
      description:
        "Auto grouping by available metadata options includes: Host name, geographic location, isolation country, species, genus, and collection year.",
    },
    {
      header: "Feature Groups",
      description:
        "This option allows users to select previously identified groups of sequences saved to their workspace.",
    },
    {
      header: "Alignment File",
      description:
        "This option allows users to select a previously aligned group of nucleotides or proteins.",
    },
    {
      header: "Select Feature Group",
      description:
        "This option allows users to specify feature groups previously saved to their workbench.",
    },
    {
      header: "DNA/PROTEIN",
      description:
        "Allows users to specify whether their sequences are nucleic acid or protein sequences.",
    },
    {
      header: "Group names",
      description: "User-specified names for custom groups.",
    },
    {
      header: "Delete Rows",
      description: "Allows users to delete unwanted sequences.",
    },
  ],
};

// ------------------------------------------------------------ //
// ------------- Proteome Comparison Service Info ------------- //
// ------------------------------------------------------------ //
export const proteomeComparisonInfo: ServiceInfoPopup = {
  title: "Proteome Comparison Overview",
  description:
    "The bacterial Proteome Comparison Service performs protein sequence-based genome comparison \
        using bidirectional BLASTP. This service allows users to select up to eight genomes, either public or private, \
        and compare them to a user-selected or supplied reference genome. The proteome comparison result is displayed as an \
        interactive circular genome view and is downloadable as a print-quality image or tabular comparison results.",
};

export const proteomeComparisonParameters: ServiceInfoPopup = {
  title: "Parameters",

  sections: [
    {
      header: "Advanced parameters",
      subsections: [
        {
          subheader: "Minimum % coverage",
          subdescription:
            "Minimum percent sequence coverage of query and subject in blast. Use up or down arrows to change the value. The default value is 30%.",
        },
        {
          subheader: "BLAST E value",
          subdescription: "Maximum BLAST E value. The default value is 1e-5.",
        },
        {
          subheader: "Minimum % Identity",
          subdescription:
            "Minimum percent sequence identity of query and subject in BLAST. Use up or down arrows to change the value. The default value is 10%.",
        },
      ],
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

export const proteomeComparisonComparisonGenomes: ServiceInfoPopup = {
  title: "Comparison Genomes Selection",
  description:
    "Select up to total of 9 genomes from the genome list or FASTA files or a feature groups and use the plus buttons to place the genomes to the table.",
  sections: [
    {
      header: "Select genome",
      description: "Type or select a genome name from the genome list.",
    },
    {
      header: "And/or select FASTA file",
      description:
        "Select or upload an external genome file in protein FASTA format.",
    },
    {
      header: "And/or select feature group",
      description: "Select a feature group from the workspace.",
    },
  ],
};

export const proteomeComparisonReferenceGenome: ServiceInfoPopup = {
  title: "Reference Genome Selection",
  description:
    "Select a reference genome from the genome list or a FASTA file or a feature group. Only one reference is allowed.",
  sections: [
    {
      header: "Select a genome",
      description: "Type or select a genome name from the genome list.",
    },
    {
      header: "Or a FASTA file",
      description:
        "Select or upload an external genome file in protein FASTA format.",
    },
    {
      header: "Or a feature group",
      description:
        "Select a feature group from the workspace to show comparison of specific proteins instead of all proteins in a genome.",
    },
  ],
};

// ------------------------------------------------------------ //
// ------------- Metagenomic Binning Service Info ------------- //
// ------------------------------------------------------------ //
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

// ----------------------------------------------------------------- //
// ------------- Metagenomic Read Mapping Service Info ------------- //
// ----------------------------------------------------------------- //
export const metagenomicReadMappingInfo: ServiceInfoPopup = {
  title: "Metagenomic Read Mapping Overview",
  description:
    "The Metagenomic Read Mapping Service uses <a href='https://bmcbioinformatics.biomedcentral.com/articles/10.1186/s12859-018-2336-6'>KMA</a> to align reads against antibiotic resistance genes, virulence factors, or other custom sets of genes.",
};

export const metagenomicReadMappingParameters: ServiceInfoPopup = {
  title: "Parameters",
  sections: [
    {
      header: "Predefined Gene Set Name",
      description:
        "A pre-built set of genes against which reads are mapped. Two options are available:",
      subsections: [
        {
          subheader: "CARD",
          subdescription:
            "Antibiotic resistence gene set from the <a href='https://www.ncbi.nlm.nih.gov/pubmed/27789705>Comprehensive Antibiotic Resistance Database</a>",
        },
        {
          subheader: "VFDB",
          subdescription:
            "Virulence factor gene set from the <a href='https://www.ncbi.nlm.nih.gov/pubmed/30395255>Virulence Factor Database</a>",
        },
      ],
    },
    {
      header: "Feature Group",
      description:
        "Reads can also be mapped to a previously created groups of features (genes or proteins). There are several ways to navigate to the feature group. Clicking on the drop-down box will show the feature groups, with the most recently created groups shown first. Clicking on the desired group will fill the box with that name.",
    },
    {
      header: "Fasta File",
      description:
        "Reads can be mapped to a fasta file describing an dna sequence. The file must be present in BV-BRC, which would be located by entering the name in the text box, clicking on the drop-down box, or navigating within the workspace. Inorder to select a file for this service the file type must be specified as one of our fasta types (aligned_dna_fasta, or feature_dna_fasta).",
    },
    {
      header: "Output Folder",
      description: "Workspace folder where the results will be saved.",
    },
    {
      header: "Output Name",
      description: "User-provided name used to uniquely identify results.",
    },
  ],
};

// ---------------------------------------------------------------- //
// ------------- Taxonomy Classification Service Info ------------- //
// ---------------------------------------------------------------- //
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

// ------------------------------------------------------------ //
// ------------- Fastq Utilities Service Info ------------- //
// ------------------------------------------------------------ //
export const fastqUtilitiesInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The Fastq Utilities Service makes available common operations for FASTQ files from high throughput sequencing, including: generating FastQC reports of base call quality; aligning reads to genomes using Bowtie2 to generate BAM files, saving unmapped reads and generating SamStat reports of the amount and quality of alignments; and trimming of adapters and low quality sequences using TrimGalore and CutAdapt. The Fastq Utiliites app allows the user to define a pipeline of activities to be performed to designated FASTQ files. The three components (trim, fastqc and align) can be used independently, or in any combination.These actions happen in the order in which they are specified. In the case of trimming, the action will replace untrimmed read files with trimmed ones as the target for all subsequent actions. FASTQ reads (paired-or single-end, long or short, zipped or not), as well as Sequence Read Archive accession numbers are supported.",
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

// ----------------------------------------------------------------------- //
// ------------- Influenza HA Subtype Numbering Service Info ------------- //
// ----------------------------------------------------------------------- //
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

// ------------------------------------------------------------ //
// ------------- SARS-CoV-2 Genome Analysis Service Info ------------- //
// ------------------------------------------------------------ //
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

// ------------------------------------------------------------ //
// ------------- Wastewater Analysis Service Info ------------- //
// ------------------------------------------------------------ //
export const sarsCov2WastewaterAnalysisInfo: ServiceInfoPopup = {
  title: "Overview",
  description:
    "The SARS-CoV-2 Wastewater Analysis service is a comprehensive analysis of wastewater aimed at detecting \
    and quantifying lineages and variants of concern (VOC) of the SARS-CoV-2 virus. The service accepts raw short \
    amplicon reads from wastewater samples. The service analyzes reads by aligning them to the reference genome (Wuhan-Hu-1) \
    and then analyzes the variants in the sample using Freyja. Below is an overview of the service.",
};

export const sarsCov2WastewaterAnalysisInputLib: ServiceInfoPopup = {
  title: "Input Library Selection",
  description:
    "This Service accepts read files uploaded to the workspace and SRA run accession values. This service is designed for short amplicon sequenced wastewater samples.",
  sections: [
    {
      header: "Paired Read Library",
      subsections: [
        {
          subheader: "Read File 1 & 2",
          subdescription:
            "Many paired read libraries are given as file pairs, with each file containing half of each read pair. Paired read files are expected to be sorted such that each read in a pair occurs in the same Nth position as its mate in their respective files. These files are specified as READ FILE 1 and READ FILE 2. For a given file pair, the selection of which file is READ 1 and which is READ 2 does not matter.",
        },
      ],
    },
    {
      header: "Single Read file",
      subsections: [
        {
          subheader: "Read File",
          subdescription: "The FASTQ file containing the reads.",
        },
      ],
    },
    {
      header: "SRA Run Accession",
      description:
        "Allows direct upload of read files from the NCBI Sequence Read Archive to the Assembly Service. Entering the SRR accession number and clicking the arrow will add the file to the selected libraries box for use in the assembly.",
    },
    {
      header: "Primers / Version",
      description:
        "Primer sequences play a crucial role in amplicon-based sequencing, a method used to analyze a specific region of DNA or RNA. These short, synthetic sequences of nucleotides are designed to bind (or anneal) to specific target sequences in the DNA that flank the region of interest. Once bound, primers initiate DNA amplification. The primers are specific to the target sequence. It is important to select the correct primer type and version so that the synthetic sequences can be removed from your sample.",
    },
    {
      header: "Sample Identifier",
      description:
        "The sample identifier Field will auto populate with the file name. Edit the field by clicking into the text box. The text entered to this the sample identifier fields will be used throughout the output files for the service. This documentation refers to this field as a sample id.",
    },
    {
      header: "Sample Date",
      description:
        "Type the corresponding sample date if it is available to you. Take caution to format your date as Month, Day, Year, MM/DD/YYYY. You must type the “/” between Month and Day / Day and Year. For SRA samples the date may be available in the BioSample data.",
    },
  ],
};

export const sarsCov2WastewaterAnalysisParameters: ServiceInfoPopup = {
    title: "Parameters",
    sections: [
        {
            header: "Strategy",
            description:
                "Currently there is only one strategy for this service. The raw reads are aligned to the reference genome (Wuhan-Hu-1, NC_045512) with Minimap2 with MiniMap2 2]. Then SAMtools [3] converts the aligned FASTQs into BAM files. SAMtools [3] also sorts the aligned BAM files by the leftmost coordinates. Then the primers and low-quality sequences are trimmed by iVAR [4]. FastQC [5] offers a range of quality assessments for the raw FASTQ files, as well as the aligned and sorted BAM files.",
        },
        {
            header: "Output Folder",
            description:
                "Navigate the workspace to or create the directory for the results.",
        },
        {
            header: "Output Name",
            description:
                "The text entered here will be used to create the job results directory.",
        },
    ],
};

// ------------------------------------------------------------------ //
// ------------- Subspecies Classification Service Info ------------- //
// ------------------------------------------------------------------ //
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

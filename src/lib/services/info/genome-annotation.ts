import type { ServiceInfoPopup } from "@/types/services";

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

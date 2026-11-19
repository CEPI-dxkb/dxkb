import type { FastaTypeFor } from "@/lib/data-api/fasta";
import type { FeatureViewRecord } from "./schema";

/** The identifier users recognize a feature by; `feature_id` (the Solr key) is the last resort. Blank counts as absent. */
export function featureDisplayName(feature: FeatureViewRecord): string {
  return (
    [feature.patric_id, feature.refseq_locus_tag, feature.protein_id].find(
      (id): id is string => Boolean(id?.trim()),
    ) ?? feature.feature_id
  );
}

/** The PATRIC annotation pipeline wrote `"undefined " + feature_type` (and a typo, `"undefind "`) into `product` for millions of non-CDS features, e.g. "undefined gap". */
const placeholderProduct = /^undefine?d(?=\s|$)\s*(.*?)\s*$/i;

/** INSDC feature keys, current ones and the deprecated ones legacy GenBank data still carries (plus PATRIC's "NonStdRes"). The pipeline's placeholder suffix is the GenBank key it read, which Solr's `feature_type` does not always repeat: "undefined mRNA" and "undefined ncRNA" rows are `misc_RNA` there. Keys are compared lower-cased. */
const placeholderFeatureKeys: ReadonlySet<string> = new Set(
  [
    "-10_signal",
    "-35_signal",
    "3'clip",
    "3'UTR",
    "5'clip",
    "5'UTR",
    "allele",
    "assembly_gap",
    "attenuator",
    "C_region",
    "CAAT_signal",
    "CDS",
    "centromere",
    "D-loop",
    "D_segment",
    "enhancer",
    "exon",
    "gap",
    "GC_signal",
    "gene",
    "iDNA",
    "intron",
    "J_segment",
    "LTR",
    "mat_peptide",
    "misc_binding",
    "misc_difference",
    "misc_feature",
    "misc_recomb",
    "misc_RNA",
    "misc_signal",
    "misc_structure",
    "mobile_element",
    "modified_base",
    "mRNA",
    "N_region",
    "ncRNA",
    "NonStdRes",
    "operon",
    "oriT",
    "polyA_signal",
    "polyA_site",
    "precursor_RNA",
    "prim_transcript",
    "primer_bind",
    "promoter",
    "propeptide",
    "protein_bind",
    "RBS",
    "regulatory",
    "rep_origin",
    "repeat_region",
    "rRNA",
    "S_region",
    "scRNA",
    "sig_peptide",
    "snoRNA",
    "snRNA",
    "source",
    "stem_loop",
    "STS",
    "TATA_signal",
    "telomere",
    "terminator",
    "tmRNA",
    "transit_peptide",
    "tRNA",
    "unsure",
    "V_region",
    "V_segment",
    "variation",
  ].map((key) => key.toLowerCase()),
);

/**
 * The feature's product, or `""` when it is absent or the Data API's "undefined <feature_type>" placeholder, so a caller's `||` fallback (feature type, then ID) can run. The word "undefined" alone is a placeholder, and so is "undefined" followed by one word that is the row's own feature type or an INSDC feature key (`placeholderFeatureKeys`). Any other product that starts with "Undefined" ("Undefined function", "undefined hypothetical protein") is kept.
 */
export function cleanFeatureProduct(
  product: unknown,
  featureType?: unknown,
): string {
  if (typeof product !== "string") return "";
  const value = product.trim();
  const match = placeholderProduct.exec(value);
  if (!match) return value;
  const rest = match[1].toLowerCase();
  if (rest === "") return "";
  const type =
    typeof featureType === "string" ? featureType.trim().toLowerCase() : "";
  return rest === type || placeholderFeatureKeys.has(rest) ? "" : value;
}

/** BV-BRC's Feature View lines under the breadcrumb: BRC ID, RefSeq locus tag, gene, product; `name` is the heading, `details` the non-blank rest (a placeholder product counts as blank). */
export function featureHeaderParts(feature: FeatureViewRecord): {
  name: string;
  details: string[];
} {
  const name = featureDisplayName(feature);
  const details = [
    feature.refseq_locus_tag,
    feature.gene,
    cleanFeatureProduct(feature.product, feature.feature_type),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value) && value !== name);
  return { name, details };
}

function hasLength(value: FeatureViewRecord["na_length"]): boolean {
  return Number(value) > 0;
}

/** FASTA flavours the feature can produce; protein only when the record has an amino-acid sequence. */
export function featureFastaTypes(
  feature: FeatureViewRecord,
): FastaTypeFor<"genome_feature">[] {
  const types: FastaTypeFor<"genome_feature">[] = [];
  if (hasLength(feature.na_length) || feature.na_sequence_md5) types.push("dna");
  if (hasLength(feature.aa_length) || feature.aa_sequence_md5)
    types.push("protein");
  return types;
}

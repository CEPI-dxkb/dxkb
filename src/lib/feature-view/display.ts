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
const placeholderProduct = /^\s*undefine?d\b\s*(.*?)\s*$/i;

/**
 * The feature's product, or `""` when it is absent or the Data API's "undefined <feature_type>" placeholder, so a caller's `||` fallback (feature type, then ID) can run. The placeholder is the word alone, or followed by exactly the row's own feature type; a caller without the type gets the looser rule that one following word is enough, since feature types are single tokens. A real product that merely starts with "Undefined" is kept whenever the type is known.
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
  if (type !== "") return rest === type ? "" : value;
  return /\s/.test(rest) ? value : "";
}

/** BV-BRC's Feature View lines under the breadcrumb: BRC ID, RefSeq locus tag, gene, product; `name` is the heading, `details` the non-blank rest. */
export function featureHeaderParts(feature: FeatureViewRecord): {
  name: string;
  details: string[];
} {
  const name = featureDisplayName(feature);
  const details = [feature.refseq_locus_tag, feature.gene, feature.product]
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

import type { FastaTypeFor } from "@/lib/data-api/fasta";
import {
  isTaxonId,
  type TaxonomyViewRecord,
} from "@/lib/taxonomy-view/schema";
import type { FeatureViewRecord } from "./schema";

/**
 * The identifier a person recognizes a feature by. `feature_id`
 * (`PATRIC.644340.17.JAEUGC010000001.CDS.12314.12580.rev`) is the Solr key —
 * it addresses the page but is never how a user names a gene — so it is the
 * last resort, for a record that carries none of the public identifiers. A
 * blank identifier counts as absent, or it would title the page with nothing.
 */
export function featureDisplayName(feature: FeatureViewRecord): string {
  return (
    [feature.patric_id, feature.refseq_locus_tag, feature.protein_id].find(
      (id): id is string => Boolean(id?.trim()),
    ) ?? feature.feature_id
  );
}

/**
 * What BV-BRC's Feature View prints in bold under its breadcrumb, in its
 * order: BRC ID, RefSeq locus tag, gene, product. `name` is the page's name
 * (the heading), so a record with no BRC ID leads with what stands in for one;
 * `details` are the rest, minus blanks.
 */
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

/** One taxon in a feature's lineage breadcrumb. */
export interface LineageCrumb {
  taxonId: string;
  name: string;
}

/**
 * The ranks BV-BRC's Feature View names in its breadcrumb (`visibleRanks` in
 * `buildHeaderContent`, `p3/widget/viewer/Feature.js`). The root, realm,
 * kingdom, sub-ranks and unranked strains between them are left out, so
 * Influenza A reads "Negarnaviricota » Insthoviricetes » … » Alphainfluenzavirus
 * influenzae" rather than starting at "Viruses » Riboviria".
 */
const breadcrumbRanks = new Set([
  "superkingdom",
  "phylum",
  "class",
  "order",
  "family",
  "genus",
  "species",
]);

function asList(value: string | number | (string | number)[] | undefined) {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

/**
 * The feature's lineage as BV-BRC's breadcrumb shows it: the taxa of the
 * ranks above, root first. A taxon without a usable id or name is skipped
 * rather than rendered as a dead link.
 */
export function featureLineageCrumbs(
  taxon: Pick<TaxonomyViewRecord, "lineage_ids" | "lineage_names" | "lineage_ranks">,
): LineageCrumb[] {
  const ids = asList(taxon.lineage_ids);
  const names = asList(taxon.lineage_names);
  return asList(taxon.lineage_ranks).flatMap((rank, index) => {
    const taxonId = ids[index];
    const name = names[index]?.trim();
    return breadcrumbRanks.has(rank) && isTaxonId(taxonId) && name
      ? [{ taxonId, name }]
      : [];
  });
}

function hasLength(value: FeatureViewRecord["na_length"]): boolean {
  return Number(value) > 0;
}

/**
 * The FASTA flavours this feature can actually produce. Offering a protein
 * download for an RNA or other untranslated feature would only ever return an
 * empty file, so it is offered when the record has an amino-acid sequence.
 */
export function featureFastaTypes(
  feature: FeatureViewRecord,
): FastaTypeFor<"genome_feature">[] {
  const types: FastaTypeFor<"genome_feature">[] = [];
  if (hasLength(feature.na_length) || feature.na_sequence_md5) types.push("dna");
  if (hasLength(feature.aa_length) || feature.aa_sequence_md5)
    types.push("protein");
  return types;
}

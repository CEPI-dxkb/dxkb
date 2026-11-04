import { isTaxonId, type TaxonomyViewRecord } from "./schema";

/** One taxon in a record's lineage breadcrumb. */
export interface LineageCrumb {
  taxonId: string;
  name: string;
}

/**
 * The ranks BV-BRC names in its breadcrumbs, verbatim (`visibleRanks` in
 * `buildHeaderContent`, `p3/widget/viewer/Taxonomy.js`, `Genome.js`,
 * `Feature.js`, `Protein.js`). Roots, realms, kingdoms, sub-, super- and
 * infra-ranks, clades and unranked groups are left out. NCBI has since
 * renamed superkingdom to domain, so on current records the trail never
 * names Bacteria, Eukaryota or Viruses; that is BV-BRC's output too, so the
 * list is not "fixed" here.
 */
export const breadcrumbRanks: ReadonlySet<string> = new Set([
  "superkingdom",
  "phylum",
  "class",
  "order",
  "family",
  "genus",
  "species",
]);

/**
 * BV-BRC's `visibleIndexes`: the lineage positions a breadcrumb shows, root
 * first. A repeated rank maps to its first position, as `indexOf` does there.
 * `withLeaf` is the Taxon View's extra step: the taxon itself (the last
 * position) is appended when its own rank is not shown, but only when some
 * rank was, because BV-BRC compares `undefined < lastIndex`, which is false.
 */
export function breadcrumbIndexes(
  ranks: readonly string[],
  { withLeaf }: { withLeaf: boolean },
): number[] {
  const indexes = ranks
    .filter((rank) => breadcrumbRanks.has(rank))
    .map((rank) => ranks.indexOf(rank));
  const lastShown = indexes.at(-1);
  const lastIndex = ranks.length - 1;
  if (withLeaf && lastShown !== undefined && lastShown < lastIndex) {
    indexes.push(lastIndex);
  }
  return indexes;
}

function asList(value: string | number | (string | number)[] | undefined) {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

/**
 * The crumbs at `indexes`. A taxon without a usable id or name is skipped
 * rather than rendered as a dead link (`taxonomyHref` rejects a bad id).
 */
function crumbsAt(
  indexes: readonly number[],
  ids: readonly string[],
  names: readonly string[],
): LineageCrumb[] {
  return indexes.flatMap((index) => {
    const taxonId = ids[index];
    const name = names[index]?.trim();
    return isTaxonId(taxonId) && name ? [{ taxonId, name }] : [];
  });
}

/**
 * A record's lineage as BV-BRC's Genome and Feature Views show it: the
 * shown ranks above the record, root first, never the record's own taxon
 * when it is unranked (a strain shows its species). A genome or feature
 * record names only its lineage, not the ranks, so this reads the taxonomy
 * record of its taxon.
 */
export function lineageCrumbs(
  taxon: Pick<TaxonomyViewRecord, "lineage_ids" | "lineage_names" | "lineage_ranks">,
): LineageCrumb[] {
  return crumbsAt(
    breadcrumbIndexes(asList(taxon.lineage_ranks), { withLeaf: false }),
    asList(taxon.lineage_ids),
    asList(taxon.lineage_names),
  );
}

/** The parallel lineage arrays of a taxonomy record (`OrganismTaxonomy`). */
export interface TaxonLineage {
  lineageIds: readonly (number | string)[];
  lineageNames: readonly string[];
  lineageRanks?: readonly string[];
}

/**
 * A taxon's lineage as BV-BRC's Taxon View shows it: the record-view crumbs,
 * then the taxon itself when its rank is not shown. The last crumb is the
 * current taxon. Empty whenever neither an ancestor nor the taxon itself has
 * a shown rank (a root, domain, kingdom or realm, or a clade or unranked group
 * above the first phylum), where BV-BRC's trail is empty too. A lineage whose ids, names and ranks differ in length
 * (a malformed record whose parsed arrays no longer line up) shows no crumbs
 * rather than crumbs on the wrong taxa.
 */
export function taxonViewCrumbs(taxon: TaxonLineage): LineageCrumb[] {
  const ranks = taxon.lineageRanks ?? [];
  if (
    ranks.length !== taxon.lineageIds.length ||
    ranks.length !== taxon.lineageNames.length
  ) {
    return [];
  }
  return crumbsAt(
    breadcrumbIndexes(ranks, { withLeaf: true }),
    taxon.lineageIds.map(String),
    taxon.lineageNames,
  );
}

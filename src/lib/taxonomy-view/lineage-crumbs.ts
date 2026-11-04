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
 * Whether the parallel lineage arrays line up. When one is short (a malformed
 * record, or a parse that dropped a bad id or name but kept every rank) each
 * later rank would land on the wrong taxon, so callers show nothing instead.
 */
function aligned(
  ids: readonly unknown[],
  names: readonly unknown[],
  ranks: readonly unknown[],
): boolean {
  return ids.length === ranks.length && names.length === ranks.length;
}

/**
 * A record's lineage as BV-BRC's Genome and Feature Views show it: the
 * shown ranks above the record, root first, never the record's own taxon
 * when it is unranked (a strain shows its species). A genome or feature
 * record names only its lineage, not the ranks, so this reads the taxonomy
 * record of its taxon. A lineage whose ids, names and ranks differ in length
 * shows no crumbs.
 */
export function lineageCrumbs(
  taxon: Pick<TaxonomyViewRecord, "lineage_ids" | "lineage_names" | "lineage_ranks">,
): LineageCrumb[] {
  const ids = asList(taxon.lineage_ids);
  const names = asList(taxon.lineage_names);
  const ranks = asList(taxon.lineage_ranks);
  if (!aligned(ids, names, ranks)) return [];
  return crumbsAt(breadcrumbIndexes(ranks, { withLeaf: false }), ids, names);
}

/** The parallel lineage arrays of a taxonomy record (`OrganismTaxonomy`). */
export interface TaxonLineage {
  lineageIds: readonly (number | string)[];
  lineageNames: readonly string[];
  lineageRanks?: readonly string[];
}

/** The Taxon View's shown positions, or null when the arrays do not line up. */
function taxonViewIndexes(taxon: TaxonLineage): number[] | null {
  const ranks = taxon.lineageRanks ?? [];
  if (!aligned(taxon.lineageIds, taxon.lineageNames, ranks)) return null;
  return breadcrumbIndexes(ranks, { withLeaf: true });
}

/**
 * A taxon's lineage as BV-BRC's Taxon View shows it: the record-view crumbs,
 * then the taxon itself when its rank is not shown. The last crumb is
 * usually the current taxon, but a blank or invalid leaf id or name drops it,
 * so `taxonViewHeader` checks before treating it as such. Empty whenever
 * neither an ancestor nor the taxon itself has a shown rank (a root, domain,
 * kingdom or realm, or a clade or unranked group above the first phylum),
 * where BV-BRC's trail is empty too. A lineage whose ids, names and ranks
 * differ in length shows no crumbs rather than crumbs on the wrong taxa.
 */
export function taxonViewCrumbs(taxon: TaxonLineage): LineageCrumb[] {
  const indexes = taxonViewIndexes(taxon);
  if (!indexes) return [];
  return crumbsAt(
    indexes,
    taxon.lineageIds.map(String),
    taxon.lineageNames,
  );
}

/**
 * The Taxon View header's parts: the crumbs that link above the heading, and
 * whether the heading is for assistive technology only. The taxon's own crumb
 * is left out of `ancestors` only when the last crumb really is that taxon;
 * otherwise (a blank leaf name, a leaf id of 0, a lineage ending at the
 * parent) every crumb is an ancestor. The heading is hidden only where BV-BRC
 * shows no trail for a lineage that has ranks; a record without ranks or with
 * misaligned arrays is malformed, not a root, and keeps a visible heading.
 */
export function taxonViewHeader(
  taxon: TaxonLineage & { taxonId: number | string },
): { ancestors: LineageCrumb[]; headingHidden: boolean } {
  const crumbs = taxonViewCrumbs(taxon);
  const own = crumbs.at(-1)?.taxonId === String(taxon.taxonId);
  return {
    ancestors: own ? crumbs.slice(0, -1) : crumbs,
    headingHidden:
      (taxon.lineageRanks?.length ?? 0) > 0 &&
      taxonViewIndexes(taxon)?.length === 0,
  };
}

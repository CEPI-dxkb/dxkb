import { isTaxonId, type TaxonomyViewRecord } from "./schema";

export interface LineageCrumb {
  taxonId: string;
  name: string;
}

/** The ranks BV-BRC shows in breadcrumbs, verbatim; after NCBI's superkingdom-to-domain rename the trail never names Bacteria, Eukaryota or Viruses. */
export const breadcrumbRanks: ReadonlySet<string> = new Set([
  "superkingdom",
  "phylum",
  "class",
  "order",
  "family",
  "genus",
  "species",
]);

/** BV-BRC's `visibleIndexes`, root first; `withLeaf` appends the taxon itself when its rank is hidden but another is shown. */
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

/** Taxa without a usable id or name are skipped rather than rendered as dead links. */
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

/** A short lineage array would put later ranks on the wrong taxa, so callers show nothing. */
function aligned(
  ids: readonly unknown[],
  names: readonly unknown[],
  ranks: readonly unknown[],
): boolean {
  return ids.length === ranks.length && names.length === ranks.length;
}

/** A record's lineage crumbs as BV-BRC's Genome and Feature Views show them; misaligned arrays yield none. */
export function lineageCrumbs(
  taxon: Pick<TaxonomyViewRecord, "lineage_ids" | "lineage_names" | "lineage_ranks">,
): LineageCrumb[] {
  const ids = asList(taxon.lineage_ids);
  const names = asList(taxon.lineage_names);
  const ranks = asList(taxon.lineage_ranks);
  if (!aligned(ids, names, ranks)) return [];
  return crumbsAt(breadcrumbIndexes(ranks, { withLeaf: false }), ids, names);
}

export interface TaxonLineage {
  lineageIds: readonly (number | string)[];
  lineageNames: readonly string[];
  lineageRanks?: readonly string[];
}

function taxonViewIndexes(taxon: TaxonLineage): number[] | null {
  const ranks = taxon.lineageRanks ?? [];
  if (!aligned(taxon.lineageIds, taxon.lineageNames, ranks)) return null;
  return breadcrumbIndexes(ranks, { withLeaf: true });
}

/** Taxon View crumbs; a blank or invalid leaf id or name drops the taxon, so `taxonViewHeader` checks the last crumb. */
export function taxonViewCrumbs(taxon: TaxonLineage): LineageCrumb[] {
  const indexes = taxonViewIndexes(taxon);
  if (!indexes) return [];
  return crumbsAt(
    indexes,
    taxon.lineageIds.map(String),
    taxon.lineageNames,
  );
}

/** Header parts: crumbs above the heading and whether the heading is screen-reader-only. */
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

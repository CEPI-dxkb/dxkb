// Raw taxonomy doc as returned by the Data API /taxonomy/ resource.
// Indexable so it satisfies InfoPanel's Record<string, unknown> selectedRow contract.
export interface TaxonRecord extends Record<string, unknown> {
  taxon_id: string | number;
  taxon_name: string;
  taxon_rank: string;
  parent_id?: number;
  genomes?: number;
}

// Strain is the leaf rank — no expand toggle, never fetches children (legacy parity).
export function isLeaf(record: TaxonRecord): boolean {
  return record.taxon_rank === "strain";
}

// Rank → Badge color classes for the tree's Rank column. Lookup-map pattern mirrors
// statusConfig in src/lib/jobs/constants.ts. Coarse major-rank tint; unknown ranks
// (and "no rank") fall back to rankBadgeDefault.
export const rankBadgeDefault = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600";
export const rankConfig: Record<string, string> = {
  superkingdom: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
  kingdom: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
  phylum: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700",
  class: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  order: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700",
  family: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700",
  genus: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  species: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  serotype: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700",
  subtype: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700",
  strain: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
};

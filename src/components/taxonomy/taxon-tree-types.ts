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

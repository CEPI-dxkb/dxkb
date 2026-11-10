// Raw taxonomy doc from the Data API /taxonomy/ resource; indexable to satisfy InfoPanel's Record<string, unknown> contract.
export interface TaxonRecord extends Record<string, unknown> {
  taxon_id: string | number;
  taxon_name: string;
  taxon_rank: string;
  parent_id?: number;
  genomes?: number;
}

export function isLeaf(record: TaxonRecord): boolean {
  return record.taxon_rank === "strain";
}

export interface TimelineItemType {
    id: number;
    title: string;
    description?: string;
    time: string;
  }

// Taxonomy-related interfaces
export interface TaxonomyItem {
  taxon_id: number;
  taxon_name: string;
  taxon_rank?: string;
  lineage_names?: string[];
  division?: string;
}

export interface TaxonomySearchParams {
  query?: string;
  includeEukaryotes?: boolean;
  includeBacteria?: boolean;
  includeViruses?: boolean;
  setBacteriophage?: boolean;
  pageSize?: number;
}

export interface TaxonomySelectorProps {
  value?: TaxonomyItem | null;
  onChange?: (item: TaxonomyItem | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}
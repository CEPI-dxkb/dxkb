export interface Citation {
  id: string;
  title: string;
  authors: string;
  year: number;
  type: string;
  journal: string;
  abstract: string;
  citationCount: number;
  impactFactor: number;
  doi: string;
}

export interface YearMetrics {
  count: number;
  totalCitations: number;
  avgImpact: number;
}

export interface Author {
  name: string;
  count: number;
}

export type SortOption = "newest" | "oldest" | "highest-impact" | "most-cited";
export type PublicationType = "Journal Article" | "Conference Paper" | "Book Chapter" | "All"; 
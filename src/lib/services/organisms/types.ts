/** A count that loaded, or the error it failed with; never a stand-in number. */
export type CountResult =
  | { status: "fulfilled"; value: number }
  | { status: "rejected"; reason: unknown };

export interface OrganismSummary {
  count: number | null;
  uniqueFamily: number | null;
  uniqueGenus: number | null;
  uniqueSpecies: number | null;
  cds: number | null;
  matPeptide: number | null;
  /**
   * Not awaited with the rest: the structure join takes about 23 s cold for
   * Bacteria, so the summary resolves without it and the page streams the PDB
   * tile on its own. The promise never rejects: a failed join is a `rejected`
   * `CountResult`, so it cannot take the other counts down.
   */
  pdb: Promise<CountResult>;
}

export interface OrganismTaxonomy {
  taxonId: number;
  taxonName: string;
  lineageNames: string[];
  lineageIds: number[];
  /**
   * NCBI rank of each lineage entry, index-aligned with `lineageIds`; the
   * breadcrumb filters on it.
   */
  lineageRanks?: string[];
  taxonRank: string;
  genomes: number | null;
}

export interface OrganismGenusFacet {
  name: string;
  count: number;
}

export type OrganismMetadataFacets = Record<string, OrganismGenusFacet[]>;

export interface OrganismFetchOptions {
  signal?: AbortSignal;
}

export interface OrganismGeoLocationMeta {
  count: number;
  genera: Record<string, number>;
  hosts: Record<string, number>;
}

export interface OrganismGeoDistribution {
  countryData: Record<string, number>;
  countryMeta: Record<string, OrganismGeoLocationMeta>;
  stateData: Record<string, number>;
  stateMeta: Record<string, OrganismGeoLocationMeta>;
  countyData: Record<string, number>;
  countyMeta: Record<string, OrganismGeoLocationMeta>;
  /**
   * Why the state to county counts could not be read, condensed for display. Absent when that
   * query answered, even with no rows, so an error is never mistaken for "no county data".
   */
  countyError?: string;
}

export interface SerotypeYear {
  year: number;
  [serovar: string]: number;
}

export interface SerotypeDistributionData {
  years: SerotypeYear[];
  serovars: string[];
}

export type AmrPhenotype = "Resistant" | "Susceptible" | "Intermediate";

export interface AmrAntibioticRow {
  antibiotic: string;
  Resistant: number;
  Susceptible: number;
  Intermediate: number;
  total: number;
}

export interface AmrDistributionData {
  antibiotics: AmrAntibioticRow[];
}

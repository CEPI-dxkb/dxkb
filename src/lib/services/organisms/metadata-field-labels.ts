/** Chart titles for the genome metadata fields the overview charts facet on. */
const metadataFieldLabels: Record<string, string> = {
  genus: "Genus",
  host: "Host",
  host_name: "Host Name",
  host_group: "Host Group",
  host_common_name: "Host Distribution",
  isolation_country: "Isolation Country",
  isolation_source: "Isolation Source Distribution",
  collection_year: "Collection Year",
  family: "Family",
  sequencing_centers: "Sequencing Centers",
};

/** Titles of the overview charts that are not one metadata field's. */
export const taxonomicDistributionTitle = "Taxonomic Distribution";
export const amrProfileTitle = "Antimicrobial Resistance Profile";

/**
 * What a metadata chart is called, for its title and for the error a failed
 * facet shows ("Isolation Country: The BV-BRC data service is unavailable
 * (…)."), so the user never reads a field name such as `isolation_country`.
 * An unlisted field keeps its name.
 */
export function metadataFieldLabel(field: string): string {
  return metadataFieldLabels[field] ?? field;
}

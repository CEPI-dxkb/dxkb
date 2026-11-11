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

export const taxonomicDistributionTitle = "Taxonomic Distribution";
export const amrProfileTitle = "Antimicrobial Resistance Profile";

/**
 * Chart title for a metadata field, also used in a failed facet's error; an
 * unlisted field keeps its name.
 */
export function metadataFieldLabel(field: string): string {
  return metadataFieldLabels[field] ?? field;
}

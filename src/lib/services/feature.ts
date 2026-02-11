export interface FeatureSummary {
  aa_length?: number;
  aa_sequence_md5?: string;
  accession?: string;
  annotation?: string;
  date_inserted?: string;
  date_modified?: string;
  end?: number;
  feature_id: string;
  feature_type?: string;
  figfam_id?: string;
  genome_id?: string;
  genome_name?: string;
  location?: string;
  na_length?: number;
  na_sequence_md5?: string;
  owner?: string;
  patric_id?: string;
  pgfam_id?: string;
  plfam_id?: string;
  product?: string;
  public?: boolean;
  sequence_id?: string;
  start?: number;
  strand?: string;
  taxon_id?: number;
  go?: string[];
  property?: string[];
  segments?: string[];
  _version?: number;
}

interface FetchFeaturesFromGroupOptions {
  signal?: AbortSignal;
}

export async function fetchFeaturesFromGroup(
  featureGroupPath: string,
  options: FetchFeaturesFromGroupOptions = {},
): Promise<FeatureSummary[]> {
  if (!featureGroupPath || featureGroupPath.trim() === "") {
    return [];
  }

  try {
    const response = await fetch("/api/services/feature/from-group", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ feature_group_path: featureGroupPath.trim() }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error || "Failed to fetch features from feature group";
      throw new Error(message);
    }

    const data = await response.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }

    throw error;
  }
}

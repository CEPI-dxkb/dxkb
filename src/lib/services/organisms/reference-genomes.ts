import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  responseErrorMessage,
  throwOrganismFetchError,
} from "./utils";

export interface ReferenceGenome {
  reference_genome: string;
  genome_name: string;
  genome_id: string;
}

export async function fetchReferenceGenomes(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<ReferenceGenome[]> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const query = [
    `eq(taxon_lineage_ids,${String(taxonId)})`,
    `eq(reference_genome,*)`,
    `select(reference_genome,genome_name,genome_id)`,
    `limit(25000)`,
    `facet((field,reference_genome),(mincount,1))`,
    `json(nl,map)`,
  ].join("&");

  const response = await fetchOrganism(`${baseUrl}/genome/?${query}`, "reference-genomes", {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json().catch((error: unknown) =>
    throwOrganismFetchError(error, "reference-genomes"),
  )) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("reference-genomes: unexpected response shape: expected array");
  }

  return payload.map((doc: unknown, index: number) => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error(`reference-genomes: unexpected doc shape at index ${String(index)}`);
    }
    const d = doc as Record<string, unknown>;
    return {
      reference_genome: typeof d.reference_genome === "string" ? d.reference_genome : "",
      genome_name: typeof d.genome_name === "string" ? d.genome_name : "",
      genome_id: typeof d.genome_id === "string" ? d.genome_id : "",
    };
  });
}

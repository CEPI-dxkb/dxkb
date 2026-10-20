import { genomeScopeRql, type GenomeScope } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  organismResponseError,
  throwOrganismFetchError,
  type OrganismRequest,
} from "./utils";

// Unlabelled: the card showing a failure names it ("Reference genomes could
// not be loaded").
const referenceGenomesRequest: OrganismRequest = { source: "reference-genomes" };

export interface ReferenceGenome {
  reference_genome: string;
  genome_name: string;
  genome_id: string;
}

export async function fetchReferenceGenomes(
  scope: GenomeScope,
  options: OrganismFetchOptions = {},
): Promise<ReferenceGenome[]> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const query = [
    genomeScopeRql(scope),
    `eq(reference_genome,*)`,
    `select(reference_genome,genome_name,genome_id)`,
    `limit(25000)`,
    `facet((field,reference_genome),(mincount,1))`,
    `json(nl,map)`,
  ].join("&");

  const response = await fetchOrganism(`${baseUrl}/genome/?${query}`, referenceGenomesRequest, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw await organismResponseError(response, referenceGenomesRequest);
  }

  const payload = (await response.json().catch((error: unknown) =>
    throwOrganismFetchError(error, referenceGenomesRequest, response.url || undefined),
  )) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("Unexpected BV-BRC response shape: expected an array of genomes");
  }

  return payload.map((doc: unknown, index: number) => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error(`Unexpected BV-BRC response shape: genome ${String(index)} is not an object`);
    }
    const d = doc as Record<string, unknown>;
    return {
      reference_genome: typeof d.reference_genome === "string" ? d.reference_genome : "",
      genome_name: typeof d.genome_name === "string" ? d.genome_name : "",
      genome_id: typeof d.genome_id === "string" ? d.genome_id : "",
    };
  });
}

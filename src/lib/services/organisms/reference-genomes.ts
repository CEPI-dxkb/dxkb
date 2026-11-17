import { rqlEq } from "@/lib/views/rql";

import { genomeScopeRql, type GenomeScope } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetList,
  requiredNumber,
  type OrganismRequest,
} from "./utils";

const referenceGenomesRequest: OrganismRequest = { source: "reference-genomes" };

export interface ReferenceGenome {
  reference_genome: string;
  genome_name: string;
  genome_id: string;
  genbank_accessions: string;
}

/**
 * The types the card always has a tab for. Leaving an empty one out made All
 * and the only other tab show the same count with nothing saying why
 * (Adenoviridae: no Representative genome, All 355 and Reference 355).
 */
const knownReferenceGenomeTypes = ["Reference", "Representative"];

/**
 * How many genomes of each type the card inlines; the cap is per type so a huge
 * type cannot crowd out a small one (Viruses: 24,890 Reference, 21
 * Representative).
 */
export const inlineReferenceGenomeLimit = 1000;

export interface ReferenceGenomeSummary {
  rows: ReferenceGenome[];
  counts: Record<string, number>;
  total: number;
}

const genomeFields =
  "select(reference_genome,genome_name,genome_id,genbank_accessions)";

function responseBody(payload: Record<string, unknown>): Record<string, unknown> {
  const body = payload.response;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Unexpected BV-BRC response shape: expected a response object");
  }
  return body as Record<string, unknown>;
}

function parseGenomes(payload: Record<string, unknown>): ReferenceGenome[] {
  const { docs } = responseBody(payload);
  if (!Array.isArray(docs)) {
    throw new Error("Unexpected BV-BRC response shape: expected an array of genomes");
  }
  return docs.map((doc: unknown, index: number) => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error(`Unexpected BV-BRC response shape: genome ${String(index)} is not an object`);
    }
    const d = doc as Record<string, unknown>;
    return {
      reference_genome: typeof d.reference_genome === "string" ? d.reference_genome : "",
      genome_name: typeof d.genome_name === "string" ? d.genome_name : "",
      genome_id: typeof d.genome_id === "string" ? d.genome_id : "",
      genbank_accessions:
        typeof d.genbank_accessions === "string" ? d.genbank_accessions : "",
    };
  });
}

export async function fetchReferenceGenomes(
  scope: GenomeScope,
  options: OrganismFetchOptions = {},
): Promise<ReferenceGenomeSummary> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const scopeRql = genomeScopeRql(scope);
  const read = (clauses: string[]) =>
    fetchOrganismSolrJson(
      `${baseUrl}/genome/?${[scopeRql, ...clauses].join("&")}`,
      referenceGenomesRequest,
      options.signal,
    );

  // No `json(nl,map)`: it makes the website API answer a bare array that drops
  // the facet counts and the total.
  const summary = await read([
    `eq(reference_genome,*)`,
    genomeFields,
    `limit(1)`,
    `facet((field,reference_genome),(mincount,1))`,
  ]);
  const total = requiredNumber(responseBody(summary).numFound, "numFound");
  const facet = parseSolrFacetList(summary, "reference_genome");
  const facetCounts = Object.fromEntries(
    facet.map(({ name, count }) => [name, count]),
  );
  const counts: Record<string, number> = {
    ...Object.fromEntries(knownReferenceGenomeTypes.map((type) => [type, 0])),
    ...facetCounts,
  };

  // A zero count has no rows to read.
  const types = Object.keys(counts)
    .filter((type) => counts[type] > 0)
    .sort();
  const perType = await Promise.all(
    types.map(async (type) =>
      parseGenomes(
        await read([
          // Percent-encode like genome-scope.ts, then escape the `(` `)`
          // encodeURIComponent leaves alone.
          rqlEq("reference_genome", encodeURIComponent(type)),
          genomeFields,
          // A name alone leaves its ties in an unspecified order, which decides
          // which genomes make the cap on a partial list.
          `sort(+genome_name,+genome_id)`,
          `limit(${String(inlineReferenceGenomeLimit)})`,
        ]),
      ),
    ),
  );

  return { rows: perType.flat(), counts, total };
}

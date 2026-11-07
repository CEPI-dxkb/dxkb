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

// Unlabelled: the card showing a failure names it ("Reference genomes could
// not be loaded").
const referenceGenomesRequest: OrganismRequest = { source: "reference-genomes" };

export interface ReferenceGenome {
  reference_genome: string;
  genome_name: string;
  genome_id: string;
}

/**
 * How many genomes of each type the card inlines into the page. A taxon like
 * Bacteria has over 21,000 Representative genomes; the card shows about 20 at
 * a time, so the rest of a larger type is a click away in the Genomes tab
 * instead of in the HTML. The cap is per type so a huge type cannot crowd a
 * small one out (Viruses: 24,890 Reference, 21 Representative).
 */
export const inlineReferenceGenomeLimit = 1000;

export interface ReferenceGenomeSummary {
  /** Per type, at most `inlineReferenceGenomeLimit`, by name. */
  rows: ReferenceGenome[];
  /** Genomes per type ("Reference", "Representative", ...), over all of them. */
  counts: Record<string, number>;
  /** Every reference or representative genome in the scope (`numFound`). */
  total: number;
}

const genomeFields = "select(reference_genome,genome_name,genome_id)";

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

  // No `json(nl,map)`: it makes the website API answer a bare array, which
  // drops the facet counts and the total. One row is read only because the
  // docs of this read are unused: the per-type reads below carry the rows.
  const summary = await read([
    `eq(reference_genome,*)`,
    genomeFields,
    `limit(1)`,
    `facet((field,reference_genome),(mincount,1))`,
  ]);
  const total = requiredNumber(responseBody(summary).numFound, "numFound");
  const facet = parseSolrFacetList(summary, "reference_genome");
  const counts = Object.fromEntries(facet.map(({ name, count }) => [name, count]));

  const types = facet.map(({ name }) => name).sort();
  const perType = await Promise.all(
    types.map(async (type) =>
      parseGenomes(
        await read([
          // Percent-encode like genome-scope.ts (the clause joins a GET query
          // string), then escape the `(` `)` encodeURIComponent leaves alone.
          rqlEq("reference_genome", encodeURIComponent(type)),
          genomeFields,
          `sort(+genome_name)`,
          `limit(${String(inlineReferenceGenomeLimit)})`,
        ]),
      ),
    ),
  );

  return { rows: perType.flat(), counts, total };
}

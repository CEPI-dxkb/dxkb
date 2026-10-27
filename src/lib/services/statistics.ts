import {
  fetchUpstream,
  upstreamResponseError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "@/lib/env";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export type StatisticKey =
  | "viralGenomes"
  | "proteinEntries"
  | "virusSpecies"
  | "epitopes"
  | "taxons"
  | "proteinStructures"
  | "proteinFeatures"
  | "genomes";

export interface StatisticDefinition {
  readonly key: StatisticKey;
  readonly label: string;
  readonly core: string;
  readonly filter: string;
}

export const dbStatisticsDefinitions: readonly StatisticDefinition[] = Object.freeze([
  { key: "viralGenomes", label: "Viral Genomes", core: "genome", filter: "eq(superkingdom,Viruses)" },
  { key: "proteinEntries", label: "Protein Entries", core: "genome_feature", filter: "eq(feature_type,CDS)" },
  { key: "virusSpecies", label: "Virus Species", core: "taxonomy", filter: "and(eq(taxon_rank,species),eq(lineage,*Viruses*))" },
  { key: "epitopes", label: "Epitopes", core: "epitope", filter: "" },
  { key: "taxons", label: "Taxons", core: "taxonomy", filter: "" },
  { key: "proteinStructures", label: "Protein Structures", core: "protein_structure", filter: "" },
  { key: "proteinFeatures", label: "Protein Features", core: "protein_feature", filter: "" },
  { key: "genomes", label: "Genomes", core: "genome", filter: "" },
] as const);

export type StatisticCounts = Record<StatisticKey, number | null>;

export interface DbStatistics {
  /** Each count, or `null` where its request failed. */
  counts: StatisticCounts;
  /**
   * Why no count could be loaded: the first failure, condensed (an HTML
   * maintenance page reduced to its title). `null` while any count loaded;
   * empty when the failure carried no message.
   */
  unavailableReason: string | null;
}

interface FetchOptions {
  signal?: AbortSignal;
}

interface SolrCountResponse {
  response?: { numFound?: unknown };
}

const oneHourSeconds = 3600;

function buildCountUrl(baseUrl: string, definition: StatisticDefinition): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const filter = definition.filter ? `${definition.filter}&` : "";
  return `${trimmedBase}/${definition.core}/?${filter}limit(1)`;
}

async function fetchCount(
  definition: StatisticDefinition,
  baseUrl: string,
  signal: AbortSignal | undefined,
): Promise<number> {
  const url = buildCountUrl(baseUrl, definition);
  // A spent budget or a refused connection throws an `UpstreamError` naming
  // the service and host; a non-OK answer is described from its status and
  // the readable part of its body, never the maintenance page's markup. The
  // shared Data API budget applies: the CDS count over `genome_feature`
  // routinely takes 7–8 s.
  const response = await fetchUpstream(
    url,
    {
      method: "GET",
      headers: { Accept: "application/solr+json" },
      signal,
      next: { revalidate: oneHourSeconds },
    },
    { service: upstreamServices.dataApi, timeoutMs: upstreamTimeoutMs.dataApi },
  );

  if (!response.ok) {
    throw await upstreamResponseError(response, upstreamServices.dataApi);
  }

  const payload = (await response.json()) as SolrCountResponse;
  const numFound = payload.response?.numFound;
  if (typeof numFound !== "number" || !Number.isFinite(numFound)) {
    throw new Error(`Unexpected SOLR response shape — missing response.numFound`);
  }
  return numFound;
}

export async function fetchDbStatistics(
  options: FetchOptions = {},
): Promise<DbStatistics> {
  const baseUrl = getRequiredEnv("NEXT_PUBLIC_DATA_API");
  const settled = await Promise.allSettled(
    dbStatisticsDefinitions.map((definition) =>
      fetchCount(definition, baseUrl, options.signal),
    ),
  );

  const counts = {} as StatisticCounts;
  const failures: unknown[] = [];
  settled.forEach((result, index) => {
    const definition = dbStatisticsDefinitions[index];
    if (result.status === "fulfilled") {
      counts[definition.key] = result.value;
      return;
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.error(`BV-BRC count failed for ${definition.core}: ${reason}`);
    failures.push(result.reason);
    counts[definition.key] = null;
  });

  return {
    counts,
    unavailableReason:
      failures.length === settled.length
        ? formatUserFacingErrorMessage(failures[0], "")
        : null,
  };
}

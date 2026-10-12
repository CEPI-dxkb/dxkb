import { apiCall, apiGet } from "@/lib/api/client";
import { splitIdList } from "@/lib/services/workspace/id-group";

export interface GenomeSummary {
  genome_id: string;
  genome_name: string;
  public?: boolean;
  owner?: string;
  reference_genome?: string;
  strain?: string;
  superkingdom?: string;
  taxon_id?: number;
}

interface GenomeSuggestionOptions {
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchGenomeSuggestions(
  query: string,
  options: GenomeSuggestionOptions = {},
): Promise<GenomeSummary[]> {
  const trimmed = query.trim();
  const { limit = 25, signal } = options;

  try {
    const data = await apiGet<{ results: GenomeSummary[] }>(
      "/api/services/genome/search",
      { q: trimmed || "", limit },
      { signal },
    );
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }
    throw error;
  }
}

/**
 * Looks genomes up by ID. `fields` adds genome fields to the default
 * summary (name, strain, owner, ...); the route drops any that are not plain
 * field names.
 */
export async function fetchGenomesByIds(
  genomeIds: string[],
  options: { signal?: AbortSignal; fields?: string[] } = {},
): Promise<GenomeSummary[]> {
  if (genomeIds.length === 0) return [];

  const uniqueIds = Array.from(new Set(genomeIds));

  try {
    const data = await apiCall<{ results: GenomeSummary[] }>(
      "/api/services/genome/by-ids",
      options.fields?.length
        ? { genome_ids: uniqueIds, fields: options.fields }
        : { genome_ids: uniqueIds },
      { signal: options.signal },
    );
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }
    throw error;
  }
}

export async function fetchAllGenomeIds(
  options: { signal?: AbortSignal } = {},
): Promise<GenomeSummary[]> {
  try {
    const data = await apiCall<{ results: GenomeSummary[] }>(
      "/api/services/genome/get-all-ids",
      {},
      { signal: options.signal },
    );
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }
    throw error;
  }
}

export async function getGenomeIdsFromGroup(
  path: string,
  options: { signal?: AbortSignal } = {},
): Promise<string[]> {
  if (!path) {
    return [];
  }

  try {
    return genomeIdsFromGroupContent(
      await fetchGroupContent(path, options.signal),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }

    throw error;
  }
}

/**
 * The text of a failed workspace call: the upstream message the proxy passes
 * on as `apiResponse` (or a JSON-RPC `error`), without BV-BRC's `_ERROR_`
 * markers, before the proxy's own summary ("BV-BRC API error: 500 ...").
 */
function workspaceErrorMessage(body: unknown): string | null {
  const { apiResponse, error } = (body ?? {}) as {
    apiResponse?: { message?: unknown };
    error?: unknown;
  };
  const candidates = [
    apiResponse?.message,
    (error as { message?: unknown } | null | undefined)?.message,
    error,
  ];
  const message = candidates.find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  return message ? message.replace(/^_ERROR_|_ERROR_$/g, "").trim() : null;
}

/**
 * Reads a group's stored content through the workspace proxy. Every failure
 * becomes an Error worth showing: the backend's own message when it sent one,
 * otherwise "Invalid workspace response for genome group" for a body that is
 * not a usable `Workspace.get` result (null, empty, HTML, no entry).
 */
async function fetchGroupContent(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch("/api/services/workspace", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "Workspace.get",
      params: [
        {
          objects: [path],
          metadata_only: false,
        },
      ],
    }),
    signal,
  });

  const data: unknown = await response.json().catch(() => null);
  // An abort while the body streams is still an abort, not a bad response.
  signal?.throwIfAborted();

  const rpcError = (data as { error?: unknown } | null)?.error;
  if (!response.ok || (rpcError !== undefined && rpcError !== null)) {
    throw new Error(
      workspaceErrorMessage(data) ?? "Failed to load genome group",
    );
  }

  const entry = extractWorkspaceGetEntry(data);

  if (!entry) {
    throw new Error("Invalid workspace response for genome group");
  }

  const rawData: unknown = Array.isArray(entry)
    ? entry[1]
    : ((entry as { data?: unknown }).data ?? null);
  return decodeGroupData(rawData);
}

/**
 * The genome ids of a decoded group. `id_list.genome_id` is normally a string
 * array, but some older groups store one comma-separated string.
 */
function genomeIdsFromGroupContent(content: unknown): string[] {
  const ids = (content as { id_list?: { genome_id?: unknown } } | null)
    ?.id_list?.genome_id;

  if (Array.isArray(ids)) {
    return ids.filter((id): id is string => typeof id === "string");
  }

  if (typeof ids === "string") {
    return splitIdList(ids);
  }

  return [];
}

function decodeGroupData(raw: unknown): unknown {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (jsonError) {
      try {
        const decoded = (() => {
          if (
            typeof window !== "undefined" &&
            typeof window.atob === "function"
          ) {
            return window.atob(raw);
          }

          if (
            typeof globalThis !== "undefined" &&
            (
              globalThis as unknown as {
                Buffer?: {
                  from(
                    s: string,
                    enc: string,
                  ): { toString(enc: string): string };
                };
              }
            ).Buffer
          ) {
            return (
              globalThis as unknown as {
                Buffer: {
                  from(
                    s: string,
                    enc: string,
                  ): { toString(enc: string): string };
                };
              }
            ).Buffer.from(raw, "base64").toString("utf-8");
          }

          throw new Error(
            "Base64 decoding is not supported in this environment",
          );
        })();
        return JSON.parse(decoded);
      } catch (decodeError) {
        console.error("Failed to decode genome group data", {
          jsonError,
          decodeError,
        });
        return null;
      }
    }
  }

  if (typeof raw === "object") {
    return raw;
  }

  return null;
}

function extractWorkspaceGetEntry(responseData: unknown): unknown {
  const result = (responseData as { result?: unknown } | null)?.result;
  const container: unknown = Array.isArray(result) ? result[0] : null;

  if (!container) {
    return null;
  }

  if (Array.isArray(container)) {
    const entry: unknown = container[0];
    if (Array.isArray(entry)) {
      return entry;
    }
    if (entry && typeof entry === "object") {
      const entryObj = entry as Record<string, unknown>;
      if (Array.isArray(entryObj[0])) {
        return entryObj[0];
      }
      if (entryObj.metadata !== undefined && entryObj.data !== undefined) {
        return [entryObj.metadata, entryObj.data];
      }
    }
    return entry;
  }

  if (typeof container === "object") {
    const firstValue = Object.values(container as Record<string, unknown>)[0];
    if (Array.isArray(firstValue)) {
      return firstValue[0];
    }
    if (
      firstValue &&
      typeof firstValue === "object" &&
      "data" in firstValue &&
      "metadata" in firstValue
    ) {
      return [firstValue.metadata, firstValue.data];
    }
  }

  return null;
}

export interface ViralGenomeValidationResult {
  genome_id: string;
  superkingdom?: string;
  genome_length?: number | null;
  contigs?: number | null;
}

function isViralGenomeValidationResult(
  value: unknown,
): value is ViralGenomeValidationResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { genome_id?: unknown }).genome_id === "string"
  );
}

export interface ViralGenomeValidationErrors {
  duplicate_error?: string;
  kingdom_error?: string;
  contigs_error?: string;
  genomelength_error?: string;
  missing_superkingdom?: string;
  missing_genomes_error?: string;
  missing_metadata_error?: string;
}

/**
 * The message for a genome group that fails viral validation, worded as on
 * the legacy site: its heading, then one "- " line per error (alpha's `<br>`
 * breaks are `\n`, which the app's toast descriptions keep). Alpha's MSA page
 * says "This is an invalid genome group"; every other tree page uses this
 * heading, so the site uses it throughout.
 */
export function formatInvalidGenomeGroupMessage(
  errors: ViralGenomeValidationErrors,
): string {
  const messages = Object.values(errors).filter(
    (error): error is string => Boolean(error),
  );
  if (messages.length === 0) {
    return "Invalid genome group. Please check that all genomes are viruses with single contigs.";
  }

  return [
    "This looks like an invalid genome group. The following errors were found:",
    ...messages.map((error) => `- ${error}`),
  ].join("\n");
}

/**
 * Maximum genome ids sent to `/api/services/genome/validate-viral` per request.
 * The route turns the whole list into one `in(genome_id,(...))` clause on a GET
 * query string, so an unbatched call for a 5,000-genome group builds a ~50 KB
 * URL that the upstream BV-BRC data API rejects. Batching mirrors
 * `fetchSelectedRows` / `maxSelectedRows` in the data-API layer.
 */
export const maxViralValidationIdsPerRequest = 200;

export async function validateViralGenomes(
  genomeIds: string[],
  options: { signal?: AbortSignal; maxGenomeLength?: number } = {},
): Promise<{
  allValid: boolean;
  errors: ViralGenomeValidationErrors;
  results: ViralGenomeValidationResult[];
}> {
  const { signal, maxGenomeLength = 250000 } = options;

  if (genomeIds.length === 0) {
    return { allValid: true, errors: {}, results: [] };
  }

  const uniqueIds = Array.from(new Set(genomeIds));

  try {
    const batchCount = Math.ceil(
      uniqueIds.length / maxViralValidationIdsPerRequest,
    );
    const batches = await Promise.all(
      Array.from({ length: batchCount }, (_, index) =>
        // `apiCall` gives undefined for an empty body, so nothing about the
        // response is assumed: a missing list or entry counts as missing
        // metadata below, not a TypeError.
        apiCall<{ results?: unknown } | null | undefined>(
          "/api/services/genome/validate-viral",
          {
            genome_ids: uniqueIds.slice(
              index * maxViralValidationIdsPerRequest,
              (index + 1) * maxViralValidationIdsPerRequest,
            ),
          },
          { signal },
        ),
      ),
    );
    const results = batches
      .flatMap((batch): unknown[] =>
        Array.isArray(batch?.results) ? batch.results : [],
      )
      .filter(isViralGenomeValidationResult);

    const errors: ViralGenomeValidationErrors = {};
    let allValid = true;
    const returnedIds = new Set(results.map((genome) => genome.genome_id));
    const missingIds = uniqueIds.filter((id) => !returnedIds.has(id));
    if (missingIds.length > 0) {
      allValid = false;
      errors.missing_genomes_error = `Missing validation metadata for ${String(missingIds.length)} genome${missingIds.length === 1 ? "" : "s"}. First occurrence: ${missingIds[0]}`;
    }

    results.forEach((genome) => {
      if (!genome.superkingdom) {
        allValid = false;
        if (!errors.missing_superkingdom) {
          errors.missing_superkingdom = `Missing superkingdom field for genome_id: ${genome.genome_id}`;
        }
        return;
      }

      if (genome.superkingdom !== "Viruses") {
        allValid = false;
        if (!errors.kingdom_error) {
          errors.kingdom_error = `Invalid Superkingdom: only virus genomes are permitted\nFirst occurrence for genome_id: ${genome.genome_id}`;
        }
      }

      if (genome.contigs == null || genome.genome_length == null) {
        allValid = false;
        if (!errors.missing_metadata_error) {
          errors.missing_metadata_error = `Missing contig or genome length metadata for genome_id: ${genome.genome_id}`;
        }
      } else {
        if (genome.contigs > 1) {
          allValid = false;
          if (!errors.contigs_error) {
            errors.contigs_error = `Error: only 1 contig is permitted\nFirst occurrence for genome_id: ${genome.genome_id}`;
          }
        }

        if (genome.genome_length > maxGenomeLength) {
          allValid = false;
          if (!errors.genomelength_error) {
            errors.genomelength_error = `Error: genome exceeds maximum length ${String(maxGenomeLength)}\nFirst occurrence for genome_id: ${genome.genome_id}`;
          }
        }
      }
    });

    return { allValid, errors, results };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { allValid: false, errors: {}, results: [] };
    }

    throw error;
  }
}

export async function fetchGenomeGroupMembers(
  path: string,
): Promise<GenomeSummary[]> {
  if (!path) {
    return [];
  }

  try {
    return await fetchGenomesByIds(
      genomeIdsFromGroupContent(await fetchGroupContent(path)),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }

    throw error;
  }
}

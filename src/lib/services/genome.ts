export interface GenomeSummary {
  genome_id: string;
  genome_name: string;
  public?: boolean;
  owner?: string;
  reference_genome?: string;
  strain?: string;
  superkingdom?: string;
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

  if (!trimmed) {
    return [];
  }

  const { limit = 25, signal } = options;
  const params = new URLSearchParams({
    q: trimmed,
    limit: `${limit}`,
  });

  try {
    const response = await fetch(`/api/services/genome/search?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error || "Failed to search genomes";
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

export async function fetchGenomesByIds(
  genomeIds: string[],
  options: { signal?: AbortSignal } = {},
): Promise<GenomeSummary[]> {
  if (genomeIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(genomeIds));

  try {
    const response = await fetch("/api/services/genome/by-ids", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ genome_ids: uniqueIds }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error || "Failed to fetch genome metadata";
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

function decodeGroupData(raw: unknown): any {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (jsonError) {
      try {
        const decoded = (() => {
          if (typeof window !== "undefined" && typeof window.atob === "function") {
            return window.atob(raw);
          }

          if (typeof globalThis !== "undefined" && (globalThis as any).Buffer) {
            return (globalThis as any).Buffer.from(raw, "base64").toString("utf-8");
          }

          throw new Error("Base64 decoding is not supported in this environment");
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

function extractWorkspaceGetEntry(responseData: any): any | null {
  const container = responseData?.result?.[0];

  if (!container) {
    return null;
  }

  if (Array.isArray(container)) {
    const entry = container[0];
    if (Array.isArray(entry)) {
      return entry;
    }
    if (entry && typeof entry === "object") {
      if (Array.isArray(entry[0])) {
        return entry[0];
      }
      if (entry.metadata && entry.data !== undefined) {
        return [entry.metadata, entry.data];
      }
    }
    return entry;
  }

  if (typeof container === "object") {
    const firstValue = Object.values(container)[0];
    if (Array.isArray(firstValue)) {
      return firstValue[0];
    }
    if (firstValue && typeof firstValue === "object" && "data" in firstValue && "metadata" in firstValue) {
      return [(firstValue as any).metadata, (firstValue as any).data];
    }
  }

  return null;
}

export async function fetchGenomeGroupMembers(path: string): Promise<GenomeSummary[]> {
  if (!path) {
    return [];
  }

  try {
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
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error || "Failed to load genome group";
      throw new Error(message);
    }

    const data = await response.json();
    const entry = extractWorkspaceGetEntry(data);

    if (!entry) {
      throw new Error("Invalid workspace response for genome group");
    }

    const rawData = Array.isArray(entry) ? entry[1] : entry?.data ?? null;
    const decoded = decodeGroupData(rawData);

    if (!decoded?.id_list?.genome_id) {
      return [];
    }

    const genomeIds: string[] = decoded.id_list.genome_id.filter((id: unknown) => typeof id === "string");

    return fetchGenomesByIds(genomeIds);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }

    throw error;
  }
}


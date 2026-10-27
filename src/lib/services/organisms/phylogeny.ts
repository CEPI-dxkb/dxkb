import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  UpstreamError,
  upstreamResponseError,
} from "@/lib/api/upstream-failure";
import { canonicalDatasetId } from "@/lib/phylogeny/nextstrain-dataset";

const contentOrigin = "https://www.bv-brc.org";
const bacterialTreeBaseUrl = `${contentOrigin}/api/content/bvbrc_phylogeny_tab/phyloxml/`;
const viralFamilyBaseUrl = `${contentOrigin}/api/content/phyloxml_trees/families/`;
const phylogenyMetadataFetchTimeoutMs = 2000;
const phylogenyTreeFetchTimeoutMs = 30_000;
/** How failure messages name the backend these reads reach. */
const treeService = "the BV-BRC phylogeny tree service";

export interface PhyloTreeRef {
  name: string;
  definition?: string;
  path: string;
  metadata?: string;
  region?: string;
}

export interface PhyloGroup {
  key: string;
  title: string;
  archaeopteryx?: PhyloTreeRef[];
  nextstrain?: PhyloTreeRef[];
}

export interface PhyloFamilyBlock {
  order?: string[];
  groups: PhyloGroup[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseTreeRef(value: unknown): PhyloTreeRef | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.path !== "string"
  ) {
    return null;
  }
  return {
    name: value.name,
    path: value.path,
    ...(typeof value.definition === "string"
      ? { definition: value.definition }
      : {}),
    ...(typeof value.metadata === "string" ? { metadata: value.metadata } : {}),
    ...(typeof value.region === "string" ? { region: value.region } : {}),
  };
}

function parseTreeRefs(value: unknown): PhyloTreeRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value
    .map(parseTreeRef)
    .filter((ref): ref is PhyloTreeRef => ref !== null);
  return refs.length > 0 ? refs : undefined;
}

/**
 * One browser read from the tree service, request and body, under a budget.
 * A spent budget or a failed connection throws `UpstreamError` with the status
 * the app-wide retry policy reads (504, 502), so an outage is not retried and
 * the user reads "… did not respond (timed out after 30 s)" instead of
 * "signal timed out" or "Failed to fetch". `read` handles the response,
 * non-OK included; what it throws is rethrown as is.
 */
async function readTreeService<T>(
  url: string,
  accept: string,
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: { Accept: accept },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await read(response);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const failure = describeUpstreamFailure(error, treeService, { timeoutMs });
    if (failure) throw new UpstreamError(failure, { cause: error });
    throw error;
  }
}

/** The JSON a body holds, or `null` when it is not JSON (an HTML error page). */
function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function parseFamilyBlock(value: unknown): PhyloFamilyBlock {
  if (!isRecord(value) || !Array.isArray(value.groups)) {
    throw new Error("viral family response has an invalid shape");
  }
  const groups = value.groups.flatMap((group): PhyloGroup[] => {
    if (
      !isRecord(group) ||
      typeof group.key !== "string" ||
      typeof group.title !== "string"
    ) {
      return [];
    }
    const archaeopteryx = parseTreeRefs(group.archaeopteryx);
    const nextstrain = parseTreeRefs(group.nextstrain);
    if (!archaeopteryx && !nextstrain) return [];
    return [{ key: group.key, title: group.title, archaeopteryx, nextstrain }];
  });
  return {
    groups,
    ...(Array.isArray(value.order)
      ? {
          order: value.order.filter(
            (key): key is string => typeof key === "string",
          ),
        }
      : {}),
  };
}

export async function fetchBacterialTreeXml(
  taxonId: number,
): Promise<string | null> {
  // The server holds BV-BRC's ~32 MB taxon-to-tree dictionary and answers
  // with one filename. Its first lookup after a restart downloads that file,
  // so this waits as long as a tree download rather than the metadata budget.
  const value = await readTreeService(
    `/api/phylogeny/bacterial-trees/${String(taxonId)}`,
    "application/json",
    phylogenyTreeFetchTimeoutMs,
    async (response) => {
      const body = await response.text();
      const parsed = parseJson(body);
      if (response.ok) return parsed;
      // The route's own `{error}` already names the cause; without one (a
      // proxy's HTML page) the status and page title do. Either way the status
      // lets the app-wide retry policy skip an outage (502–504).
      if (isRecord(parsed) && typeof parsed.error === "string") {
        throw Object.assign(new Error(parsed.error), {
          status: response.status,
        });
      }
      throw new UpstreamError(
        describeUpstreamResponse(response, body, treeService),
      );
    },
  );
  if (
    !isRecord(value) ||
    !(value.filename === null || typeof value.filename === "string")
  ) {
    throw new Error("tree dictionary has an invalid shape");
  }
  if (value.filename === null) return null;
  const url = new URL(value.filename, bacterialTreeBaseUrl);
  if (url.origin !== contentOrigin)
    throw new Error("tree dictionary returned an unsafe URL");
  return fetchTreeXml(url.toString());
}

export async function fetchViralFamilyBlock(
  taxonId: number,
): Promise<PhyloFamilyBlock> {
  const id = String(taxonId);
  const url = `${viralFamilyBaseUrl}${id}/${id}.json`;
  const value = await readTreeService(
    url,
    "application/json",
    phylogenyMetadataFetchTimeoutMs,
    async (response): Promise<unknown> => {
      if (!response.ok) throw await upstreamResponseError(response, treeService);
      return response.json();
    },
  );
  return parseFamilyBlock(value);
}

export async function fetchNextstrainInventory(
  datasetIds: string[],
): Promise<Set<string>> {
  const params = new URLSearchParams();
  for (const id of datasetIds) params.append("id", id);
  const response = await fetch(`/api/phylogeny/nextstrain-datasets?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Nextstrain inventory: ${String(response.status)}`);

  const value: unknown = await response.json();
  if (!isRecord(value) || !Array.isArray(value.ids)) {
    throw new Error("Nextstrain inventory has an invalid shape");
  }

  const ids = value.ids.map((id) =>
    typeof id === "string" ? canonicalDatasetId(id) : null,
  );
  if (ids.some((id) => id === null)) {
    throw new Error("Nextstrain inventory contains an invalid identifier");
  }

  return new Set(ids as string[]);
}

export async function fetchTreeXml(url: string): Promise<string> {
  return readTreeService(
    url,
    "application/xml,text/xml",
    phylogenyTreeFetchTimeoutMs,
    async (response) => {
      if (!response.ok) throw await upstreamResponseError(response, treeService);
      return response.text();
    },
  );
}

export function resolvePhylogenyUrl(path: string): string | null {
  try {
    const url = new URL(path, contentOrigin);
    return url.protocol === "https:" && url.origin === contentOrigin
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

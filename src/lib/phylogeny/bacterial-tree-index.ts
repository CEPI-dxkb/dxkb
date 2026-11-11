import "server-only";
import { fetchUpstream, upstreamResponseError } from "@/lib/api/upstream-failure";

const defaultDictionaryUrl =
  "https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json";
// ~32 MB of JSON: a cold read takes seconds, so this budget matches the tree download's.
const dictionaryFetchTimeoutMs = 30_000;
const dictionaryService = "the BV-BRC phylogeny tree dictionary";
const dictionaryTtlMs = 24 * 60 * 60 * 1000;
// After a failed background refresh the saved dictionary keeps serving; wait this long before retrying.
const refreshRetryDelayMs = 5 * 60 * 1000;

interface TreeIndex {
  loadedAt: number;
  filenames: Map<string, string>;
}

let index: TreeIndex | null = null;
let loading: Promise<TreeIndex> | null = null;
let lastRefreshFailureAt: number | null = null;

async function loadIndex(): Promise<TreeIndex> {
  const url = process.env.PHYLO_TREE_DICTIONARY_URL ?? defaultDictionaryUrl;
  const response = await fetchUpstream(
    url,
    {
      headers: { Accept: "application/json" },
      // Next's data cache rejects entries over 2 MB; this module is the cache.
      cache: "no-store",
    },
    { service: dictionaryService, timeoutMs: dictionaryFetchTimeoutMs },
  );
  if (!response.ok) {
    throw await upstreamResponseError(response, dictionaryService);
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("tree dictionary has an invalid shape");
  }
  const shared = new Map<string, string>();
  const filenames = new Map<string, string>();
  for (const [taxonId, filename] of Object.entries(value)) {
    if (!/^\d+$/.test(taxonId) || typeof filename !== "string") continue;
    let name = shared.get(filename);
    if (name === undefined) {
      shared.set(filename, filename);
      name = filename;
    }
    filenames.set(taxonId, name);
  }
  // A 200 like `{}` parses but holds no taxa; accepting it would replace a working dictionary.
  if (filenames.size === 0) {
    throw new Error("tree dictionary has no valid entries");
  }
  return { loadedAt: Date.now(), filenames };
}

function reload(): Promise<TreeIndex> {
  loading ??= loadIndex()
    .then((next) => {
      index = next;
      return next;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The dictionary is downloaded once per process; a stale copy keeps answering while a fresh one loads. */
export async function bacterialTreeFilename(
  taxonId: number,
): Promise<string | null> {
  const current = index ?? (await reload());
  const now = Date.now();
  // Only the lookup that starts a refresh watches it, so a failure is logged once.
  if (
    loading === null &&
    now - current.loadedAt > dictionaryTtlMs &&
    (lastRefreshFailureAt === null ||
      now - lastRefreshFailureAt >= refreshRetryDelayMs)
  ) {
    reload()
      .then(() => {
        lastRefreshFailureAt = null;
      })
      .catch((error: unknown) => {
        lastRefreshFailureAt = Date.now();
        console.error("phylogeny tree dictionary refresh failed", error);
      });
  }
  return current.filenames.get(String(taxonId)) ?? null;
}

export function resetBacterialTreeIndexForTests(): void {
  index = null;
  loading = null;
  lastRefreshFailureAt = null;
}

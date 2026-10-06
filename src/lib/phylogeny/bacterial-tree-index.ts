import "server-only";

const defaultDictionaryUrl =
  "https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json";
// ~32 MB of JSON (4.3 MB gzipped). A cold server-side read takes seconds, so
// this budget matches the tree download's, not the 2 s metadata budget.
const dictionaryFetchTimeoutMs = 30_000;
// BV-BRC republishes the trees rarely (the file was last modified 2024-01-23).
const dictionaryTtlMs = 24 * 60 * 60 * 1000;
// After a failed background refresh the saved dictionary keeps serving; wait
// this long before hitting the failing upstream (and the log) again.
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
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(dictionaryFetchTimeoutMs),
    // Next's data cache rejects entries over 2 MB; this module is the cache.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `tree dictionary: ${`${String(response.status)} ${response.statusText}`.trim()}`,
    );
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("tree dictionary has an invalid shape");
  }
  // 499,508 taxa share 2,900 files: keep one copy of each filename.
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
  // A 200 like `{}` or `{ "error": "..." }` parses fine but holds no taxa;
  // accepting it would replace a working dictionary and hide every tree.
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

/**
 * The phyloXML filename BV-BRC publishes for a bacterial taxon, or `null` when
 * the taxon has none. The dictionary is downloaded once per server process; a
 * stale copy keeps answering while a fresh one loads in the background.
 */
export async function bacterialTreeFilename(
  taxonId: number,
): Promise<string | null> {
  const current = index ?? (await reload());
  const now = Date.now();
  // Only the lookup that starts a refresh watches it, so one failure is
  // logged once rather than once per request that arrived while it ran.
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

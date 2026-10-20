// src/lib/taxon-view/phylo-manifest.ts
import { describeUpstreamFailure, hostOf } from "@/lib/api/upstream-failure";
import {
  organismBvBrcRevalidateSeconds,
  organismFetchCacheInit,
  responseErrorMessage,
} from "@/lib/services/organisms/utils";

import type { PhyloManifest } from "./tab-context";

const defaultManifestUrl = "https://www.bv-brc.org/api/content/phyloxml_trees/manifest.json";
// Bounds worst-case added latency on the taxon page (this fetch runs parallel
// to, but is awaited before, page render). A slow/dead endpoint only disables
// the Phylogeny tab, so failing fast matters more than tolerating slow success.
const manifestFetchTimeoutMs = 2000;

function isTreeMap(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.every(([taxonId, tree]) => /^\d+$/.test(taxonId) && tree != null);
}

function parseManifest(payload: unknown): PhyloManifest | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const object = payload as Record<string, unknown>;
  if (isTreeMap(object.trees)) return { trees: object.trees };
  return isTreeMap(object) ? { trees: object } : null;
}

/**
 * Fetch the published-viral-tree manifest (doc §4.5/§7.2). Fail-open by design:
 * a missing/broken manifest must NEVER block the taxon page — it only means the
 * viral Phylogeny tab is treated as "no tree" (disabled). PHYLO_MANIFEST_URL can
 * override the public BV-BRC manifest URL for mirrors and test deployments.
 */
export async function fetchPhyloManifest(): Promise<PhyloManifest | null> {
  const url = process.env.PHYLO_MANIFEST_URL ?? defaultManifestUrl;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(manifestFetchTimeoutMs),
      ...organismFetchCacheInit(organismBvBrcRevalidateSeconds),
    });
    if (!response.ok) {
      console.error(`phylo-manifest: ${await responseErrorMessage(response)}`);
      return null;
    }
    return parseManifest(await response.json());
  } catch (error) {
    // undici's own message is only "fetch failed"; name what timed out or
    // could not be reached, and the host, so the log says which host is down.
    const failure = describeUpstreamFailure(error, "the BV-BRC phylogeny manifest", {
      timeoutMs: manifestFetchTimeoutMs,
    });
    const message =
      failure?.message ?? (error instanceof Error ? error.message : String(error));
    console.error(`phylo-manifest (${hostOf(url) ?? url}): ${message}`);
    return null;
  }
}

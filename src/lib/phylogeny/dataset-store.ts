import "server-only";

import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  directoryPrefix,
  isWithinDirectory,
  localDatasetIds,
  sidecars,
  type Sidecar,
} from "./dataset-inventory";
import { datasetFilename, parseDatasetId } from "./nextstrain-dataset";

export { sidecars, type Sidecar };

const remoteDatasetUrl = "https://www.bv-brc.org/charon/getDataset";
const remoteFetchTimeoutMs = 30_000;
const remoteRequestHeaders = {
  Accept: "application/json",
  "User-Agent": "curl/8.7.1",
};
const availableRemoteDatasetIds = new Set<string>();
let inventoryPromise: Promise<Set<string>> | null = null;

function datasetDirectory(): string | null {
  const directory = process.env.NEXTSTRAIN_DATASET_DIR;
  return directory ? resolve(directory) : null;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export function availableDatasetIds(): Promise<Set<string>> {
  const directory = datasetDirectory();
  if (!directory) return Promise.resolve(new Set());

  if (!inventoryPromise) {
    inventoryPromise = localDatasetIds(directory).catch((error: unknown) => {
      inventoryPromise = null;
      throw error;
    });
  }

  return inventoryPromise;
}

export function resetDatasetInventoryForTests(): void {
  inventoryPromise = null;
  availableRemoteDatasetIds.clear();
}

function remoteUrl(datasetId: string, sidecar?: Sidecar): URL {
  const url = new URL(remoteDatasetUrl);
  url.searchParams.set("prefix", `nextstrain-viewer/${datasetId}`);
  if (sidecar) url.searchParams.set("type", sidecar);
  return url;
}

async function probeRemoteDataset(datasetId: string): Promise<boolean> {
  const response = await fetch(remoteUrl(datasetId), {
    method: "HEAD",
    headers: remoteRequestHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(remoteFetchTimeoutMs),
  });
  if (response.status === 404) return false;
  if (!response.ok)
    throw new Error(`remote dataset probe: ${String(response.status)}`);
  availableRemoteDatasetIds.add(datasetId);
  return true;
}

export async function remoteDatasetExists(datasetId: string): Promise<boolean> {
  try {
    return await probeRemoteDataset(datasetId);
  } catch {
    return false;
  }
}

export async function fetchRemoteDataset(
  datasetId: string,
  sidecar?: Sidecar,
): Promise<string | null> {
  if (
    !availableRemoteDatasetIds.has(datasetId) &&
    !(await probeRemoteDataset(datasetId))
  ) {
    return null;
  }

  const response = await fetch(remoteUrl(datasetId, sidecar), {
    headers: remoteRequestHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(remoteFetchTimeoutMs),
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`remote dataset fetch: ${String(response.status)}`);
  return response.text();
}

export async function readDataset(
  datasetId: string,
  sidecar?: Sidecar,
): Promise<string | null> {
  const parts = parseDatasetId(datasetId);
  if (!parts) return null;

  const directory = datasetDirectory();
  if (!directory) return null;

  const target = resolve(directory, datasetFilename(parts, sidecar));
  if (!target.startsWith(directoryPrefix(directory))) return null;

  const directoryRealPath = await realpath(directory);

  let targetRealPath: string;
  try {
    targetRealPath = await realpath(target);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }

  if (!isWithinDirectory(directoryRealPath, targetRealPath)) return null;

  try {
    const stats = await stat(targetRealPath);
    if (!stats.isFile()) return null;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }

  try {
    return await readFile(targetRealPath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

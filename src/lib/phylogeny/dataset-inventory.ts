import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { canonicalDatasetId, sidecars, type Sidecar } from "./nextstrain-dataset";

export { sidecars, type Sidecar };

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/** `directory` with exactly one trailing separator ("/" stays "/"). */
export function directoryPrefix(directory: string): string {
  return directory.endsWith(sep) ? directory : `${directory}${sep}`;
}

export function isWithinDirectory(parent: string, child: string): boolean {
  return child === parent || child.startsWith(directoryPrefix(parent));
}

export function isAuspiceV2Dataset(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "version" in value &&
    (value.version === "v2" || value.version === "2.0") &&
    "meta" in value &&
    typeof value.meta === "object" &&
    value.meta !== null &&
    !Array.isArray(value.meta) &&
    "tree" in value &&
    typeof value.tree === "object" &&
    value.tree !== null &&
    !Array.isArray(value.tree)
  );
}

export async function renderableDatasetId(
  directoryRealPath: string,
  filename: string,
): Promise<string | null> {
  if (
    !filename.endsWith(".json") ||
    sidecars.some((sidecar) => filename.endsWith(`_${sidecar}.json`))
  ) {
    return null;
  }

  const datasetId = canonicalDatasetId(
    filename.slice(0, -".json".length).split("_").join("/"),
  );
  if (!datasetId) return null;

  let targetRealPath: string;
  try {
    targetRealPath = await realpath(resolve(directoryRealPath, filename));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  if (!isWithinDirectory(directoryRealPath, targetRealPath)) return null;

  try {
    if (!(await stat(targetRealPath)).isFile()) return null;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }

  try {
    const value: unknown = JSON.parse(await readFile(targetRealPath, "utf8"));
    return isAuspiceV2Dataset(value) ? datasetId : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function localDatasetIds(directory: string): Promise<Set<string>> {
  const [directoryRealPath, files] = await Promise.all([
    realpath(directory),
    readdir(directory),
  ]);
  const ids = await Promise.all(
    files.map((filename) => renderableDatasetId(directoryRealPath, filename)),
  );
  return new Set(ids.filter((id): id is string => id !== null));
}

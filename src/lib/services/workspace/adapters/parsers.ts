/**
 * Response parsers for Workspace API methods. Extracted from the previous
 * in-client dispatcher so each method's parse behavior is independently
 * testable.
 */

import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { metaListToObj } from "../helpers";
import type { WorkspaceItem } from "../domain";
import { toWorkspaceItem } from "../domain";

/**
 * Parse a `Workspace.ls` result. Raw shape: result[0] is a map from requested
 * path -> list of object tuples. Only the listing for `requestedPath` is
 * returned. Unmatched / missing entries yield an empty array.
 */
export function parseLsResult(
  rawResult: unknown,
  requestedPath: string,
): WorkspaceBrowserItem[] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const pathsMap = rawResult[0];
  if (!pathsMap || typeof pathsMap !== "object") return [];
  const entries = (pathsMap as Record<string, unknown>)[requestedPath];
  if (!Array.isArray(entries)) return [];
  return entries.map(
    (tuple) => metaListToObj(tuple as unknown[]) as WorkspaceBrowserItem,
  );
}

/**
 * Same as `parseLsResult` but returns the first available path's listing when
 * the exact requested path isn't found. Mirrors the fallback behavior of the
 * old `WorkspaceApiClient.makeRequest`.
 */
export function parseLsResultLoose(
  rawResult: unknown,
): WorkspaceBrowserItem[] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const pathsMap = rawResult[0];
  if (!pathsMap || typeof pathsMap !== "object") return [];
  const keys = Object.keys(pathsMap as Record<string, unknown>);
  const first = keys[0];
  if (!first) return [];
  const entries = (pathsMap as Record<string, unknown>)[first];
  if (!Array.isArray(entries)) return [];
  return entries.map(
    (tuple) => metaListToObj(tuple as unknown[]) as WorkspaceBrowserItem,
  );
}

/** Convert an ls listing into canonical `WorkspaceItem`s. */
export function lsToWorkspaceItems(items: WorkspaceBrowserItem[]): WorkspaceItem[] {
  return items.map(toWorkspaceItem);
}

/**
 * Parse `Workspace.list_permissions` into the canonical path -> entries map.
 * Result shape: result[0] is already the map; unwrap it.
 */
export function parseListPermissions(
  rawResult: unknown,
): Record<string, [string, string][]> {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return {};
  const map = rawResult[0];
  if (!map || typeof map !== "object") return {};
  return map as Record<string, [string, string][]>;
}

/**
 * Parse a Shock-upload-node `Workspace.create` result. Returns the
 * `link_reference` string from the tuple at [0][0][11].
 */
export function parseUploadNode(rawResult: unknown): string | null {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return null;
  const outer = rawResult[0];
  if (!Array.isArray(outer) || outer.length === 0) return null;
  const tuple = outer[0];
  if (!Array.isArray(tuple)) return null;
  const link = tuple[11];
  return typeof link === "string" ? link : null;
}

/**
 * Parse a `Workspace.du` response. Raw shape: result[0] = [[path, size, fileCount, dirCount, error], ...].
 */
export function parseDuResult(
  rawResult: unknown,
): [string, number, number, number, string][] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const inner = rawResult[0];
  if (!Array.isArray(inner)) return [];
  return inner as [string, number, number, number, string][];
}

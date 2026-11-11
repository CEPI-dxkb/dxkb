/** Response parsers for Workspace API methods, each testable on its own. */

import type { WorkspaceItem } from "../domain";

/**
 * Converts a raw ls tuple array into an untyped record; lives here so
 * `parsers.ts` and `client.ts` share it without a circular import.
 */
export function parseTupleToRawObject(list: unknown[]): Record<string, unknown> {
  const name = list[0];
  const parent = (list[2] as string | undefined) ?? "";
  const nameStr = (name as string | undefined) ?? "";
  return {
    id: list[4],
    path: parent + nameStr,
    name,
    type: list[1],
    creation_time: list[3],
    link_reference: list[11],
    owner_id: list[5],
    size: Number(list[6]) || 0,
    userMeta: list[7],
    autoMeta: list[8],
    user_permission: list[9],
    global_permission: list[10],
    timestamp: Date.parse(String(list[3])),
  };
}

function parseTupleToWorkspaceItem(tuple: unknown[]): WorkspaceItem {
  const name = (tuple[0] as string | undefined) ?? "";
  const parent = (tuple[2] as string | undefined) ?? "";
  const createdAt = tuple[3] ? (tuple[3] as string) : undefined;
  return {
    id: (tuple[4] as string | undefined) ?? "",
    name,
    path: parent + name,
    type: (tuple[1] as string | undefined) ?? "",
    size: Number(tuple[6]) || 0,
    ownerId: tuple[5] ? (tuple[5] as string) : undefined,
    createdAt,
    timestamp: createdAt ? Date.parse(createdAt) : undefined,
    permissions: {
      user: tuple[9] ? (tuple[9] as string) : undefined,
      global: tuple[10] ? (tuple[10] as string) : undefined,
    },
    userMeta:
      tuple[7] != null && typeof tuple[7] === "object"
        ? (tuple[7] as Record<string, unknown>)
        : undefined,
    autoMeta:
      tuple[8] != null && typeof tuple[8] === "object"
        ? (tuple[8] as Record<string, unknown>)
        : undefined,
    linkReference: tuple[11] ? (tuple[11] as string) : undefined,
    raw: parseTupleToRawObject(tuple),
  };
}

/**
 * Parses a `Workspace.ls` result: only the listing for `requestedPath`, empty
 * when unmatched.
 */
export function parseLsResult(
  rawResult: unknown,
  requestedPath: string,
): WorkspaceItem[] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const pathsMap: unknown = rawResult[0];
  if (!pathsMap || typeof pathsMap !== "object") return [];
  const entries = (pathsMap as Record<string, unknown>)[requestedPath];
  if (!Array.isArray(entries)) return [];
  return entries.map((tuple) => parseTupleToWorkspaceItem(tuple as unknown[]));
}

/**
 * Like `parseLsResult`, but falls back to the first available path's listing.
 */
export function parseLsResultLoose(rawResult: unknown): WorkspaceItem[] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const pathsMap: unknown = rawResult[0];
  if (!pathsMap || typeof pathsMap !== "object") return [];
  const keys = Object.keys(pathsMap);
  const first = keys[0];
  if (!first) return [];
  const entries = (pathsMap as Record<string, unknown>)[first];
  if (!Array.isArray(entries)) return [];
  return entries.map((tuple) => parseTupleToWorkspaceItem(tuple as unknown[]));
}

export function parseListPermissions(
  rawResult: unknown,
): Record<string, [string, string][]> {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return {};
  const map: unknown = rawResult[0];
  if (!map || typeof map !== "object") return {};
  return map as Record<string, [string, string][]>;
}

/**
 * Parses a Shock-upload-node `Workspace.create` result: the `link_reference` at
 * [0][0][11].
 */
export function parseUploadNode(rawResult: unknown): string | null {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return null;
  const outer: unknown = rawResult[0];
  if (!Array.isArray(outer) || outer.length === 0) return null;
  const tuple: unknown = outer[0];
  if (!Array.isArray(tuple)) return null;
  const link: unknown = tuple[11];
  return typeof link === "string" ? link : null;
}

/**
 * Parses a `Workspace.du` response: result[0] = [[path, size, fileCount,
 * dirCount, error], ...].
 */
export function parseDuResult(
  rawResult: unknown,
): [string, number, number, number, string][] {
  if (!Array.isArray(rawResult) || rawResult.length === 0) return [];
  const inner: unknown = rawResult[0];
  if (!Array.isArray(inner)) return [];
  return inner as [string, number, number, number, string][];
}

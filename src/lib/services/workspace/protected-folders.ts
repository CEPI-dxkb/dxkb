/**
 * Single source of truth for essential workspace folders that must never be
 * deleted: a user's `/home` and its four conventional sub-folders. The UI
 * disables DELETE for them and both repository adapters call
 * `assertNoProtectedFolders` before `Workspace.delete`.
 */

import { expectedHomeSubfolders } from "./setup";

const protectedSubfolderSet = new Set<string>(expectedHomeSubfolders);

const protectedHomeRegex = /^\/[^/]+\/home(?:\/([^/]+))?$/;

function normalize(path: string): string {
  if (!path) return "";
  return path.replace(/\/+/g, "/").replace(/\/+$/, "");
}

export function isProtectedHomeFolder(path: string): boolean {
  const normalized = normalize(path);
  if (!normalized) return false;
  const match = protectedHomeRegex.exec(normalized);
  if (!match) return false;
  // match[1] is `undefined` at runtime when the group did not match (path is
  // exactly /user/home), though TypeScript types it as `string`; the `as` cast
  // avoids no-unnecessary-condition.
  const subfolder = match[1] as string | undefined;
  if (subfolder === undefined) return true;
  return protectedSubfolderSet.has(subfolder);
}

export function findProtectedFolders(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    if (!isProtectedHomeFolder(path)) continue;
    const normalized = normalize(path);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(path);
  }
  return out;
}

export class ProtectedFolderError extends Error {
  readonly protectedPaths: string[];

  constructor(protectedPaths: string[]) {
    super(
      `Cannot delete essential workspace folders: ${protectedPaths.join(", ")}`,
    );
    this.name = "ProtectedFolderError";
    this.protectedPaths = protectedPaths;
  }
}

export function assertNoProtectedFolders(paths: string[]): void {
  const protectedPaths = findProtectedFolders(paths);
  if (protectedPaths.length === 0) return;
  throw new ProtectedFolderError(protectedPaths);
}

export const protectedFolderToastTitle = "Sorry, you can't delete that…";

export function formatProtectedFolderToastDescription(paths: string[]): string {
  const names = paths.map((p) => {
    const normalized = normalize(p);
    const segments = normalized.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? normalized;
  });
  return `You cannot delete any of the following essential folders:\n\n${names.join("\n")}`;
}

/**
 * Single source of truth for "essential workspace folders" that must never be
 * deleted: a user's `/home` directory and its four conventional sub-folders.
 *
 * Two layers consume this:
 *   1. UI — the action bar disables the DELETE button when the selection
 *      contains a protected path (see `workspace-action-bar.tsx`).
 *   2. API — both workspace repository adapters call `assertNoProtectedFolders`
 *      before issuing `Workspace.delete`, so even a programmatic caller cannot
 *      bypass the UI safeguard.
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
  const subfolder = match[1];
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

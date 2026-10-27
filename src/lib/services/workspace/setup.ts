/**
 * Idempotent provisioning of a user's BV-BRC workspace home.
 *
 * BV-BRC's reference frontend creates a user's `/home/` folder + four
 * conventional sub-folders on first workspace access. This module mirrors
 * that behavior so DXKB users don't see "_ERROR_User lacks permission" when
 * landing on `/workspace/[username]/home`.
 *
 * The transport layer is injected via `WorkspaceRpcPort` so the same logic
 * runs server-side (sign-up flow, direct fetch to `WORKSPACE_API_URL`) and
 * client-side (workspace browser, through the existing proxy).
 *
 * Folders are created only when `Workspace.ls` says the home is missing. Any
 * other `ls` failure (an outage, a maintenance page) is rethrown: it says
 * nothing about whether the home exists, and writes driven by it were
 * reported as success during the 2026-10-19 outage.
 */

import { UpstreamError } from "@/lib/api/upstream-failure";
import { isWorkspaceHomeMissing } from "./workspace-errors";

export const expectedHomeSubfolders = [
  "Genome Groups",
  "Feature Groups",
  "Experiments",
  "Experiment Groups",
] as const;

export interface WorkspaceRpcPort {
  call<T>(method: string, params: unknown[]): Promise<T>;
}

export interface EnsureUserWorkspaceInput {
  rpc: WorkspaceRpcPort;
  userId: string;
  realm: string;
}

export interface EnsureUserWorkspaceResult {
  /** Paths actually created during this call (excludes already-existing folders). */
  created: string[];
  /** Per-path error messages for batches the Workspace rejected. Non-empty means setup is incomplete. */
  failures: Record<string, string>;
}

function parseExistingFolderNames(
  rawResult: unknown,
  homePath: string,
): Set<string> {
  if (!Array.isArray(rawResult)) return new Set();
  const map: unknown = rawResult[0];
  if (!map || typeof map !== "object") return new Set();
  const items = (map as Record<string, unknown>)[homePath];
  if (!Array.isArray(items)) return new Set();

  const names = new Set<string>();
  for (const item of items) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const name: unknown = item[0];
    const type: unknown = item[1];
    if (typeof name === "string" && type === "folder") names.add(name);
  }
  return names;
}

export async function ensureUserWorkspace(
  input: EnsureUserWorkspaceInput,
): Promise<EnsureUserWorkspaceResult> {
  const { rpc, userId, realm } = input;
  const userRoot = `/${userId}@${realm}`;
  const homePath = `${userRoot}/home/`;

  let homeExists = false;
  let existingSubfolders = new Set<string>();
  try {
    const lsResult = await rpc.call<unknown>("Workspace.ls", [
      { paths: [homePath], includeSubDirs: false, Recursive: false },
    ]);
    homeExists = true;
    existingSubfolders = parseExistingFolderNames(lsResult, homePath);
  } catch (error) {
    // "_ERROR_User lacks permission" is how the Workspace says /home/ does
    // not exist yet. Anything else is not evidence of a missing home.
    if (!isWorkspaceHomeMissing(error)) throw error;
    homeExists = false;
  }

  const created: string[] = [];
  const failures: Record<string, string> = {};

  if (!homeExists) {
    try {
      await rpc.call<unknown>("Workspace.create", [
        { objects: [[homePath, "Directory"]] },
      ]);
      created.push(homePath);
    } catch (cause) {
      // The service stopped answering mid-run: stop writing.
      if (cause instanceof UpstreamError) throw cause;
      failures[homePath] =
        cause instanceof Error ? cause.message : String(cause);
    }
  }

  const missingSubfolders = expectedHomeSubfolders.filter(
    (name) => !existingSubfolders.has(name),
  );
  if (missingSubfolders.length === 0) return { created, failures };

  const subfolderPaths = missingSubfolders.map(
    (name) => `${userRoot}/home/${name}`,
  );
  try {
    await rpc.call<unknown>("Workspace.create", [
      { objects: subfolderPaths.map((path) => [path, "Directory"]) },
    ]);
    created.push(...subfolderPaths);
  } catch (cause) {
    if (cause instanceof UpstreamError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    for (const path of subfolderPaths) failures[path] = message;
  }

  return { created, failures };
}

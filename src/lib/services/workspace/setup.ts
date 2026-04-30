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
 */

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
  /** Per-path error messages for batches that failed. Best-effort: callers may inspect and log. */
  failures: Record<string, string>;
}

function parseExistingFolderNames(
  rawResult: unknown,
  homePath: string,
): Set<string> {
  if (!Array.isArray(rawResult)) return new Set();
  const map = rawResult[0];
  if (!map || typeof map !== "object") return new Set();
  const items = (map as Record<string, unknown>)[homePath];
  if (!Array.isArray(items)) return new Set();

  const names = new Set<string>();
  for (const item of items) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const name = item[0];
    const type = item[1];
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
  } catch {
    // Most commonly: "_ERROR_User lacks permission" — /home/ does not exist.
    // Treat any ls failure as "missing"; Workspace.create is idempotent so
    // re-creating an existing folder is harmless.
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
    const message = cause instanceof Error ? cause.message : String(cause);
    for (const path of subfolderPaths) failures[path] = message;
  }

  return { created, failures };
}

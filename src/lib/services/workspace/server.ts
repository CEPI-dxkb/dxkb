/**
 * Server-only workspace API. Use from RSC or route handlers only.
 * Calls WORKSPACE_API_URL with getAuthToken(); do not import in client code.
 */
import { getAuthToken } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";
import { metaListToObj } from "./helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type { ListPermissionsResult } from "./shared";

async function workspaceRequest<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error("Authentication required");
  }

  const response = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/jsonrpc+json",
      Authorization: authToken,
    },
    body: JSON.stringify({
      id: 1,
      method,
      params,
      jsonrpc: "2.0",
    }),
  });

  if (!response.ok) {
    throw new Error(`Workspace API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Workspace API error");
  }

  return data as T;
}

function processWorkspaceLsResponse(
  result: unknown,
  requestedPath: string,
): WorkspaceBrowserItem[] {
  const result0 = result as Record<string, unknown> | undefined;
  if (!result0 || typeof result0 !== "object") return [];

  const pathData = result0[requestedPath];
  if (!Array.isArray(pathData)) return [];

  let res = pathData.map((r: unknown) => metaListToObj(r as unknown[]));

  res = res.filter((r: unknown) => {
    const obj = r as Record<string, unknown>;
    if (obj.type === "folder") {
      if (
        String(obj.path)
          .split("/")
          .some((p: string) => p.charAt(0) === ".")
      ) {
        return false;
      }
    }
    return true;
  });

  return res as WorkspaceBrowserItem[];
}

/**
 * List workspaces/folders shared with the current user (server-side).
 * Uses Workspace.ls with path "/" and filters by global_permission and user_permission.
 */
export async function listSharedWithUserServer(): Promise<WorkspaceBrowserItem[]> {
  const data = await workspaceRequest<{ result?: unknown[] }>(
    "Workspace.ls",
    [
      {
        paths: ["/"],
        includeSubDirs: false,
        recursive: false,
      },
    ],
  );

  if (!data.result?.[0] || typeof data.result[0] !== "object") {
    return [];
  }

  const raw = processWorkspaceLsResponse(data.result[0], "/");
  const shared = raw.filter((r) => {
    const g = String(r.global_permission ?? "");
    const u = String(r.user_permission ?? "");
    if (g !== "n") return false;
    if (u === "o" && g === "n") return false;
    return true;
  });

  return shared;
}

/**
 * List directory contents at a full path (server-side).
 * Used when drilling into a shared folder.
 */
export async function listByFullPathServer(
  fullPath: string,
): Promise<WorkspaceBrowserItem[]> {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const data = await workspaceRequest<{ result?: unknown[] }>("Workspace.ls", [
    {
      paths: [normalized],
      includeSubDirs: false,
      recursive: false,
    },
  ]);

  if (!data.result?.[0] || typeof data.result[0] !== "object") {
    return [];
  }

  return processWorkspaceLsResponse(data.result[0], normalized);
}

/**
 * List permissions for the given paths (server-side).
 */
export async function listPermissionsServer(
  paths: string[],
): Promise<ListPermissionsResult> {
  if (paths.length === 0) return {};

  const data = await workspaceRequest<{ result?: unknown[] }>(
    "Workspace.list_permissions",
    [{ objects: paths }],
  );

  if (!data.result?.[0] || typeof data.result[0] !== "object") {
    return {};
  }
  return data.result[0] as ListPermissionsResult;
}

import { WorkspaceApiClient } from "./client";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

class PublicWorkspaceApiClient extends WorkspaceApiClient {
  constructor() {
    super();
    this.baseUrl = "/api/workspace/public";
  }
}

const publicWorkspaceApi = new PublicWorkspaceApiClient();

/** List all public workspaces (top-level, global_permission !== 'n'). */
export async function listPublicWorkspaces(): Promise<WorkspaceBrowserItem[]> {
  const raw = await publicWorkspaceApi.makeRequest<WorkspaceBrowserItem[]>(
    "Workspace.ls",
    [{ paths: ["/"], includeSubDirs: false, recursive: false }],
  );
  return raw.filter((r) => String(r.global_permission ?? "") !== "n");
}

/** List a specific user's public workspaces. */
export async function listUserPublicWorkspaces(
  username: string,
): Promise<WorkspaceBrowserItem[]> {
  if (!username) return [];
  const decoded = decodeURIComponent(username);
  const userSegment = decoded.includes("@") ? decoded : `${decoded}@bvbrc`;
  const raw = await publicWorkspaceApi.makeRequest<WorkspaceBrowserItem[]>(
    "Workspace.ls",
    [{ paths: [`/${userSegment}`], includeSubDirs: false, recursive: false }],
  );
  return raw.filter((r) => String(r.global_permission ?? "") !== "n");
}

/** List contents of a public workspace path (no filtering — already inside a public workspace). */
export async function listPublicWorkspacePath(
  fullPath: string,
): Promise<WorkspaceBrowserItem[]> {
  const decoded = decodeURIComponent(fullPath);
  const normalized = decoded.startsWith("/") ? decoded : `/${decoded}`;
  return publicWorkspaceApi.makeRequest<WorkspaceBrowserItem[]>(
    "Workspace.ls",
    [{ paths: [normalized], includeSubDirs: false, recursive: false }],
  );
}

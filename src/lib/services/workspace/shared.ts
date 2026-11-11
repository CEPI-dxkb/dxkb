import { workspaceApi } from "./client";

export type WorkspaceGetResult = unknown[];

/**
 * Fetches object metadata via Workspace.get with metadata_only; paths are
 * decoded so @ is sent literally (not %40).
 */
export async function getWorkspaceMetadata(
  objectPaths: string[],
  options?: { silent?: boolean },
): Promise<WorkspaceGetResult> {
  if (objectPaths.length === 0) return [];
  const decodedPaths = objectPaths.map((p) => decodeURIComponent(p));
  return workspaceApi.makeRequest<WorkspaceGetResult>("Workspace.get", [
    { objects: decodedPaths, metadata_only: true },
  ], options);
}

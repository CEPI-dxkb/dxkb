import { WorkspaceListParams, WorkspaceObject } from "@/lib/services/workspace/types";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";

/**
 * Workspace.ls - List workspace objects with optional filtering
 */
export class WorkspaceLsMethods {
  constructor(private client: WorkspaceApiClient) {}

  /**
   * List workspace objects with optional filtering
   */
  async listObjects(params: WorkspaceListParams): Promise<WorkspaceObject[]> {
    // The client now returns the processed array directly
    return this.client.makeRequest<WorkspaceObject[]>("Workspace.ls", [params]);
  }

  /**
   * Get objects by type (files, folders, jobs)
   */
  async getObjectsByType(
    user: string,
    type: string,
    path = "/home/",
    recursive = true,
  ): Promise<WorkspaceObject[]> {
    const params: WorkspaceListParams = {
      paths: [`/${user}@bvbrc${path}`],
      excludeDirectories: false,
      excludeObjects: false,
      query: {
        type: [type],
      },
      recursive,
    };

    // The client now handles the basic processing, we just need to filter by type
    const objects = await this.listObjects(params);

    // Apply type filtering (replicating original logic: types.indexOf(r.type) >= 0)
    return objects.filter((obj: WorkspaceObject) => {
      return [type].indexOf(obj.type) >= 0;
    });
  }

  /**
   * Search for objects by name
   */
  async searchObjects(
    user: string,
    query: string,
    path = "/home/",
    types?: string[],
  ): Promise<WorkspaceObject[]> {
    const params: WorkspaceListParams = {
      paths: [`/${user}@bvbrc${path}`],
      excludeDirectories: false,
      excludeObjects: false,
      query: {
        name: query,
        ...(types && { type: types }),
      },
      recursive: true,
    };

    const objects = await this.listObjects(params);

    // Apply type filtering if types are specified (replicating original logic)
    if (types && types.length > 0) {
      return objects.filter((obj: WorkspaceObject) => {
        return types.indexOf(obj.type) >= 0;
      });
    }

    return objects;
  }

  /**
   * Get all files in a directory
   */
  async getFiles(
    user: string,
    path = "/home/",
  ): Promise<WorkspaceObject[]> {
    return this.getObjectsByType(user, "file", path);
  }

  /**
   * Get all folders in a directory
   */
  async getFolders(
    user: string,
    path = "/home/",
  ): Promise<WorkspaceObject[]> {
    return this.getObjectsByType(user, "folder", path);
  }

  /**
   * Get all jobs
   */
  async getJobs(
    user: string,
    path = "/home/",
  ): Promise<WorkspaceObject[]> {
    return this.getObjectsByType(user, "job", path);
  }
}

import { WorkspaceApiClient } from "../client";
import {
  WorkspaceGetPermissionsParams,
  WorkspaceGetPermissionsResponse,
} from "../types";

/**
 * Workspace.get_permissions - Get permissions for workspace objects
 */
export class WorkspacePermissionsMethods {
  constructor(private client: WorkspaceApiClient) {}

  /**
   * Get permissions for workspace objects
   */
  async getPermissions(
    params: WorkspaceGetPermissionsParams,
  ): Promise<WorkspaceGetPermissionsResponse> {
    return this.client.makeRequest<WorkspaceGetPermissionsResponse>(
      "Workspace.get_permissions",
      [params],
    );
  }

  /**
   * Get permissions for a single object
   */
  async getObjectPermissions(
    workspace: string,
    id: string,
  ): Promise<WorkspaceGetPermissionsResponse> {
    return this.getPermissions({
      objects: [{ workspace, id }],
    });
  }

  /**
   * Get permissions for multiple objects
   */
  async getMultipleObjectPermissions(
    objects: Array<{ workspace: string; id: string }>,
  ): Promise<WorkspaceGetPermissionsResponse> {
    return this.getPermissions({ objects });
  }
}

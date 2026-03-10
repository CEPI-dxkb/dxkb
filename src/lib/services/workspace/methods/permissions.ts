import { WorkspaceGetPermissionsParams, WorkspaceGetPermissionsResponse } from "@/lib/services/workspace/types";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";

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
    objects: { workspace: string; id: string }[],
  ): Promise<WorkspaceGetPermissionsResponse> {
    return this.getPermissions({ objects });
  }
}

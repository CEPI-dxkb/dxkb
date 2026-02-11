// Export all types
export * from "./types";

// Validation helpers
export { checkWorkspaceObjectExists } from "./validation";

// Export the base client
export { WorkspaceApiClient, createWorkspaceApiClient, workspaceApi } from "./client";

// Export method classes
export { WorkspaceLsMethods } from "./methods/ls";
export { WorkspacePermissionsMethods } from "./methods/permissions";
export { WorkspaceCrudMethods } from "./methods/crud";

// Main workspace API class that combines all methods
import { WorkspaceApiClient } from "./client";
import { WorkspaceLsMethods } from "./methods/ls";
import { WorkspacePermissionsMethods } from "./methods/permissions";
import { WorkspaceCrudMethods } from "./methods/crud";

/**
 * Main Workspace API class that provides access to all workspace methods
 */
export class WorkspaceApi {
  public ls: WorkspaceLsMethods;
  public permissions: WorkspacePermissionsMethods;
  public crud: WorkspaceCrudMethods;

  constructor(authToken?: string) {
    const client = new WorkspaceApiClient(authToken);
    this.ls = new WorkspaceLsMethods(client);
    this.permissions = new WorkspacePermissionsMethods(client);
    this.crud = new WorkspaceCrudMethods(client);
  }
}

// Factory function for creating the main workspace API
export function createWorkspaceApi(authToken?: string): WorkspaceApi {
  return new WorkspaceApi(authToken);
}

// Default workspace API instance
export const workspace = createWorkspaceApi();

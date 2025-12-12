// Re-export everything from the workspace client module
export * from "./services/workspace";

// Main exports for workspace client
export {
  WorkspaceApiClient,
  createWorkspaceApiClient,
  workspaceApi,
} from "./services/workspace";

// Type exports
export type {
  WorkspaceObject,
  WorkspaceListParams,
  WorkspaceListResponse,
} from "./services/workspace";


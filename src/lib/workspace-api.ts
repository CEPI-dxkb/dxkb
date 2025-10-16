// Re-export everything from the new modular workspace API
export * from "./workspace";

// Legacy exports for backward compatibility
export {
  WorkspaceApiClient as WorkspaceApiClient,
  createWorkspaceApiClient,
  workspaceApi,
} from "./workspace";

// Legacy type exports
export type {
  WorkspaceObject,
  WorkspaceListParams,
  WorkspaceListResponse,
} from "./workspace";

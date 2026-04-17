// Public workspace module surface.
//
// New code should depend on the canonical domain model + repository:
//   - `./domain`                        — WorkspaceItem, conversions, WorkspaceApiError
//   - `./workspace-repository`          — WorkspaceRepository interface
//   - `./adapters/*`                    — HTTP + in-memory repositories
//   - `./workspace-query-keys`          — TanStack Query key factory
//
// `./client`, `./shared`, and `./favorites` still back a few legacy paths
// (path-resolve, job-result dot-folder fetch, favorites JSON) and are
// re-exported so existing imports keep working.

export * from "./types";
export * from "./domain";
export { workspaceQueryKeys, invalidateWorkspace } from "./workspace-query-keys";
export type { WorkspaceRepository } from "./workspace-repository";
export { checkWorkspaceObjectExists } from "./validation";
export {
  WorkspaceApiClient,
  createWorkspaceApiClient,
  workspaceApi,
} from "./client";

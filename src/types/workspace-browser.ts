import type { workspaceSortFields } from "@/constants/workspace-sort";

export type WorkspaceViewMode = "home" | "shared" | "public";

export type SortField = (typeof workspaceSortFields)[number];
export type SortDirection = "asc" | "desc";

export interface WorkspaceSortConfig {
  field: SortField;
  direction: SortDirection;
}

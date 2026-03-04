export interface WorkspaceBrowserItem {
  id: string;
  path: string;
  name: string;
  type: string;
  creation_time: string;
  link_reference: string;
  owner_id: string;
  size: number;
  userMeta: Record<string, unknown>;
  autoMeta: Record<string, unknown>;
  user_permission: string;
  global_permission: string;
  timestamp: number;
}

export type WorkspaceViewMode = "home" | "shared";

export type SortField = "name" | "type" | "size" | "owner_id" | "creation_time";
export type SortDirection = "asc" | "desc";

export interface WorkspaceBrowserSort {
  field: SortField;
  direction: SortDirection;
}

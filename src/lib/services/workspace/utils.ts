const folderLikeObjectTypes = new Set([
  "folder",
  "directory",
  "job_result",
  "modelfolder",
  "genome_group",
  "feature_group",
  "experiment_group",
]);

const folderObjectTypes = new Set([
  "folder",
  "directory",
  "modelfolder",
]);

export function normalizeWorkspaceObjectType(type: string): string {
  return (type ?? "").toLowerCase();
}

export function isFolderType(type: string): boolean {
  return folderLikeObjectTypes.has(normalizeWorkspaceObjectType(type));
}

export function isFolder(type: string): boolean {
  return folderObjectTypes.has(normalizeWorkspaceObjectType(type));
}

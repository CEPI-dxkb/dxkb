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

export function normalizeWorkspaceObjectType(
  type: string | null | undefined,
): string {
  return (type ?? "").toLowerCase();
}

export function isFolderType(type: string | null | undefined): boolean {
  return folderLikeObjectTypes.has(normalizeWorkspaceObjectType(type));
}

export function isFolder(type: string | null | undefined): boolean {
  return folderObjectTypes.has(normalizeWorkspaceObjectType(type));
}

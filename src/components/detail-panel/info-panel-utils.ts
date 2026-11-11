import type { WorkspaceItem } from "@/lib/services/workspace/domain";

export function getItemFullPath(
  item: Omit<WorkspaceItem, "path" | "name"> & {
    path?: string | null;
    name?: string | null;
  },
): string {
  const rawPath = (item.path ?? "").replace(/\/+$/, "").replace(/\/+/g, "/");
  const name = (item.name ?? "").trim();
  const nameAlreadyInPath = rawPath === name || rawPath.endsWith(`/${name}`);
  const fullPath = (nameAlreadyInPath ? rawPath : `${rawPath}/${name}`).replace(
    /\/+/g,
    "/",
  );
  const normalized = (fullPath || rawPath || item.path || "").trim();
  return normalized
    ? normalized.startsWith("/")
      ? normalized
      : `/${normalized}`
    : "";
}

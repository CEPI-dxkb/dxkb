export const protectedPageRequestHeader = "x-dxkb-request-path";

const protectedPagePrefixes = [
  "/workspace",
  "/jobs",
  "/settings",
  "/viewer",
] as const;

function isPathOrDescendant(path: string, route: string): boolean {
  return path === route || path.startsWith(`${route}/`);
}

export function isProtectedPagePath(path: string): boolean {
  if (path === "/services" || path === "/services/") return false;
  if (path.startsWith("/services/")) return true;
  if (isPathOrDescendant(path, "/workspace/public")) return false;
  if (isPathOrDescendant(path, "/workspace/workshop")) return false;
  return protectedPagePrefixes.some((prefix) =>
    isPathOrDescendant(path, prefix),
  );
}

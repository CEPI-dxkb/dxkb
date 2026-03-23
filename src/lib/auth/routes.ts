const protectedPagePrefixes = ["/services/", "/workspace", "/jobs", "/settings"] as const;
const protectedApiPrefixes = ["/api/protected/"] as const;

export function isProtectedPagePath(path: string): boolean {
  if (path === "/services") return false;
  if (path === "/workspace/public" || path.startsWith("/workspace/public/"))
    return false;
  if (path === "/workspace/workshop" || path.startsWith("/workspace/workshop/"))
    return false;
  return protectedPagePrefixes.some((prefix) => path.startsWith(prefix));
}

export function isProtectedApiPath(path: string): boolean {
  return protectedApiPrefixes.some((prefix) => path.startsWith(prefix));
}

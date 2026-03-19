const protectedPagePrefixes = ["/services/", "/workspace", "/jobs"] as const;
const protectedApiPrefixes = ["/api/protected/"] as const;

export function isProtectedPagePath(path: string): boolean {
  if (path === "/services") return false;
  return protectedPagePrefixes.some((prefix) => path.startsWith(prefix));
}

export function isProtectedApiPath(path: string): boolean {
  return protectedApiPrefixes.some((prefix) => path.startsWith(prefix));
}

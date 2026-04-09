import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};


/** Remove control characters and null bytes from a path segment. */
export function sanitizePathSegment(segment: string): string {
  if (typeof segment !== "string") return "";
  return segment
    .trim()
    .replace(/\0/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

/**
 * Encode a path segment for use in workspace URLs. Keeps `@` as `@` so it
 * displays correctly in the browser address bar (instead of %40).
 * Sanitizes input so control characters are never added to the URL.
 */
export function encodeWorkspaceSegment(segment: string): string {
  const safe = sanitizePathSegment(segment);
  return encodeURIComponent(safe).replace(/%40/g, "@");
}

/** Split a workspace path into sanitized, non-empty segments. */
export function parsePathSegments(path: string): string[] {
  return path
    .replace(/^\//, "")
    .split("/")
    .map(sanitizePathSegment)
    .filter(Boolean);
}

/** Encode an array of segments into a URL-safe workspace path string. */
export function buildEncodedSegmentPath(segments: string[]): string {
  return segments.map(encodeWorkspaceSegment).join("/");
}

/** Full username with @domain for workspace URLs (session stores short form in user.username). */
export function workspaceUsername(user: { username?: string; realm?: string } | null): string {
  if (!user?.username) return "";
  return user.realm ? `${user.username}@${user.realm}` : user.username;
}

/**
 * Returns the first non-null/undefined value for the given keys on the object.
 */
export function getFirstDefined<T extends Record<string, unknown>>(
  obj: T,
  ...keys: string[]
): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Programmatically trigger a file download via a temporary anchor element.
 */
export function triggerDownload(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  else anchor.download = "";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

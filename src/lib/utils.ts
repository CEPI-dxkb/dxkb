import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Encode a path segment for use in workspace URLs. Keeps `@` as `@` so it
 * displays correctly in the browser address bar (instead of %40).
 */
export function encodeWorkspaceSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%40/g, "@");
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

import "server-only";
import type { ProfilePatch, UpstreamProfilePatch } from "@/lib/auth/types";

/**
 * A JSON Patch on `/settings` replaces all of it, and other BV-BRC clients
 * share these accounts, so an object is patched with one `add` per key to keep
 * keys another client changed meanwhile.
 * A missing or non-object `settings` cannot be patched inside, so the whole
 * object is written: `add` when missing (RFC 6902 `replace` needs the path),
 * else `replace`; never spread an array or string.
 */
export function mergeSettingsPatches(
  patches: readonly ProfilePatch[],
  storedSettings: unknown,
): UpstreamProfilePatch[] {
  return patches.flatMap((patch): UpstreamProfilePatch[] => {
    if (patch.path !== "/settings") return [patch];
    if (!isPlainObject(storedSettings)) {
      return [
        {
          op: storedSettings === undefined ? "add" : "replace",
          path: "/settings",
          value: patch.value,
        },
      ];
    }
    return Object.entries(patch.value).map(([key, value]: [string, unknown]) => ({
      op: "add",
      path: `/settings/${key}`,
      value,
    }));
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

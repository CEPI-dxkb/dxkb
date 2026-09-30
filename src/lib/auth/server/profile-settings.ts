import "server-only";
import type { ProfilePatch, UpstreamProfilePatch } from "@/lib/auth/types";

/**
 * The profile service keeps `settings` as one JSON object, and a JSON Patch on
 * `/settings` replaces all of it. Other BV-BRC clients share these accounts and may
 * store their own keys there, so this app's settings change is merged over the
 * stored object rather than replacing it. `add` vs `replace` follows whether the
 * key exists yet (RFC 6902 `replace` needs the path to exist), so the client no
 * longer has to guess. The stored value is upstream JSON and can be anything: only a
 * plain object is merged, while a `null`, array or string is replaced by the patch
 * value alone (spreading an array or string would copy its indexes in as keys).
 */
export function mergeSettingsPatches(
  patches: readonly ProfilePatch[],
  storedSettings: unknown,
): UpstreamProfilePatch[] {
  const storedObject = isPlainObject(storedSettings) ? storedSettings : {};
  return patches.map((patch) =>
    patch.path === "/settings"
      ? {
          op: storedSettings === undefined ? "add" : "replace",
          path: "/settings",
          value: { ...storedObject, ...patch.value },
        }
      : patch,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

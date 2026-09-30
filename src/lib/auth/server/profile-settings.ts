import "server-only";
import type { ProfilePatch, UpstreamProfilePatch } from "@/lib/auth/types";

/**
 * The profile service keeps `settings` as one JSON object, and a JSON Patch on
 * `/settings` replaces all of it. Other BV-BRC clients share these accounts and may
 * store their own keys there, so when the stored settings are an object, this app's
 * change is sent as one `add` per key at `/settings/<key>` (`add` creates or
 * overwrites an object member). The service applies that to the copy it reads at
 * write time, so a key another client changed after this route read the profile is
 * kept, where writing back the whole object read here would revert it.
 *
 * The service cannot patch inside a `settings` that is missing or not an object (its
 * JSON Patch library throws on a missing or `null` parent), so then the whole object
 * is written: `add` when `settings` is missing (RFC 6902 `replace` needs the path to
 * exist) and `replace` otherwise. A stored `null`, array or string is replaced by the
 * patch value alone; spreading an array or string would copy its indexes in as keys.
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

import "server-only";
import type { ProfilePatch, UpstreamProfilePatch } from "@/lib/auth/types";

/**
 * The profile service keeps `settings` as one JSON object, and a JSON Patch on
 * `/settings` replaces all of it. Other BV-BRC clients share these accounts and may
 * store their own keys there, so this app's settings change is merged over the
 * stored object rather than replacing it. `add` vs `replace` follows whether the
 * object exists yet, so the client no longer has to guess.
 */
export function mergeSettingsPatches(
  patches: readonly ProfilePatch[],
  storedSettings: object | undefined,
): UpstreamProfilePatch[] {
  return patches.map((patch) =>
    patch.path === "/settings"
      ? {
          op: storedSettings === undefined ? "add" : "replace",
          path: "/settings",
          value: { ...storedSettings, ...patch.value },
        }
      : patch,
  );
}

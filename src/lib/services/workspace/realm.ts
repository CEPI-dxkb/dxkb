/**
 * Default workspace realm, read at call time so tests can override via
 * `process.env`; falls back to `bvbrc` until the migration to `dxkb` completes.
 */
export function getDefaultRealm(): string {
  return process.env.DEFAULT_REALM ?? "bvbrc";
}

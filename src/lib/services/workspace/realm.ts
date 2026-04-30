/**
 * Default workspace realm. Read at call time (not module-init) so tests can
 * override via `process.env`. Falls back to `bvbrc` until the migration to
 * `dxkb` is complete; the env var is the single source of truth so the cutover
 * is a deploy-time change, not a code change.
 */
export function getDefaultRealm(): string {
  return process.env.DEFAULT_REALM ?? "bvbrc";
}

import "server-only";
import { createHash } from "node:crypto";
import type { UserProfile } from "@/lib/auth/types";
import { BoundedCache } from "@/lib/genome-browser/bounded-cache";

/**
 * Successful lookups held for 30 s, keyed by a SHA-256 digest of the accepted
 * token plus the user id (`bvbrc_user_id` is a plain cookie nothing ties to the
 * token); failures are never stored and stored profiles are frozen.
 * Each forget draws a new generation from a process-wide counter, so a lookup
 * in flight across a sign-out or save cannot store its stale answer.
 * State lives on `globalThis` under a registered symbol because route handlers
 * and pages load separate server runtimes; bump the symbol's version when the
 * stored shape changes.
 */
const profileCacheTtlMs = 30_000;

interface CachedProfile {
  userId: string;
  profile: UserProfile;
}

interface ProfileCacheState {
  profiles: BoundedCache<CachedProfile>;
  generations: BoundedCache<number>;
  lastGeneration: number;
  /**
   * The generation of the last `clearProfileCache()`, so a lookup in flight
   * across a clear never matches again.
   */
  clearedGeneration: number;
}

const profileCacheStateKey = Symbol.for("dxkb.auth.profileCache.v4");

const profileCacheHolder = globalThis as typeof globalThis & {
  [profileCacheStateKey]?: ProfileCacheState;
};

const state = (profileCacheHolder[profileCacheStateKey] ??= {
  profiles: new BoundedCache<CachedProfile>({
    maxWeight: 1000,
    ttlMs: profileCacheTtlMs,
  }),
  generations: new BoundedCache<number>({
    maxWeight: 1000,
    ttlMs: profileCacheTtlMs,
  }),
  lastGeneration: 0,
  clearedGeneration: 0,
});
const { profiles, generations } = state;

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function readCachedProfile(
  userId: string,
  token: string,
): UserProfile | undefined {
  const entry = profiles.get(tokenKey(token));
  return entry?.userId === userId ? entry.profile : undefined;
}

export function profileGeneration(token: string): number {
  return generations.get(tokenKey(token)) ?? state.clearedGeneration;
}

/**
 * With `generation`, the write is skipped when the token was forgotten since.
 */
export function rememberProfile(
  userId: string,
  token: string,
  profile: UserProfile,
  generation?: number,
): void {
  const key = tokenKey(token);
  if (
    generation !== undefined &&
    generation !== (generations.get(key) ?? state.clearedGeneration)
  ) {
    return;
  }
  // The upstream JSON is not validated, so a truthy non-array `roles` is stored
  // as it came rather than spread.
  const roles = Array.isArray(profile.roles)
    ? [...profile.roles]
    : profile.roles;
  if (Array.isArray(roles)) Object.freeze(roles);
  profiles.set(key, { userId, profile: Object.freeze({ ...profile, roles }) });
}

export function forgetProfile(token: string): void {
  const key = tokenKey(token);
  profiles.delete(key);
  state.lastGeneration += 1;
  generations.set(key, state.lastGeneration);
}

/**
 * Test seam. The clear takes a generation of its own, so a lookup that began
 * before it cannot store afterwards.
 */
export function clearProfileCache(): void {
  profiles.clear();
  generations.clear();
  state.lastGeneration += 1;
  state.clearedGeneration = state.lastGeneration;
}

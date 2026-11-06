import "server-only";
import { createHash } from "node:crypto";
import type { UserProfile } from "@/lib/auth/types";
import { BoundedCache } from "@/lib/genome-browser/bounded-cache";

/**
 * Successful profile lookups for the signed-in user, held for 30 s across
 * requests, so the root layout's `getCurrentUser()` does not wait one user
 * service round trip on every server render, `router.refresh()` and soft
 * navigation (React `cache()` dedupes only within one request).
 *
 * - Only successful profile answers are cached. A failure, transient or
 *   definitive, is never stored, so the next lookup asks the service again.
 * - Entries are keyed by the exact token the upstream accepted (a SHA-256
 *   digest of it, as `sequenceCacheScope` in `src/lib/genome-browser/server.ts`
 *   does, so the raw token is never a key), and a hit also needs the user id
 *   it was stored with. `bvbrc_user_id` is a plain cookie nothing ties to the
 *   token, so a hit never answers for a pair the upstream did not accept.
 * - The 30 s TTL bounds how long a revoked token keeps a signed-in header.
 *   Only this lookup is cached: every backend call still sends the token
 *   upstream and fails there, and a rejection the auth routes and actions see
 *   clears the session, which forgets the entry (`session.ts`).
 * - Each forget gives the key a new generation, drawn from one counter for the
 *   whole process, so a key's generation never repeats, even after its record
 *   expires and a later forget creates it again. A lookup takes the generation
 *   before it asks the service and passes it to `rememberProfile`, which skips
 *   the write when the token was forgotten meanwhile, so an answer read before
 *   a sign-out or a profile save is not stored after it. Generations are kept
 *   for the same 30 s, well past the 5 s budget of the lookup they guard, in a
 *   cache of 1000 keys: only more than 1000 forgets in one process within that
 *   window can evict the record a lookup needs and let its stale answer in.
 * - Stored profiles and their `roles` array are frozen: one cached object
 *   answers many requests, so an in-place change must fail rather than leak
 *   between them.
 *
 * Next.js loads route handlers and pages (with their Server Actions) through
 * separate server runtimes, each with its own copy of this module, so the
 * state lives on `globalThis` under a registered symbol: a profile a sign-in
 * route seeds, or an eviction the profile route makes, reaches the root
 * layout's lookup in the same process. A running dev server keeps that object
 * across reloads, so bump the symbol's version whenever the stored shape
 * changes.
 */
const profileCacheTtlMs = 30_000;

interface CachedProfile {
  userId: string;
  profile: UserProfile;
}

interface ProfileCacheState {
  profiles: BoundedCache<CachedProfile>;
  /** Each recently forgotten key's generation, while a lookup may be in flight. */
  generations: BoundedCache<number>;
  /** The last generation handed out; only ever grows. */
  lastGeneration: number;
  /**
   * A token's generation when no record of it is held: the generation handed
   * out by the last `clearProfileCache()`, so a lookup in flight across a clear
   * never matches again.
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

/** The token's generation, to take before a lookup whose answer is stored. */
export function profileGeneration(token: string): number {
  return generations.get(tokenKey(token)) ?? state.clearedGeneration;
}

/**
 * Stores a frozen copy of `profile`. With `generation` (from
 * `profileGeneration` before the lookup), the write is skipped when the token
 * has been forgotten since.
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
  // The upstream JSON is not validated field by field, so a truthy `roles`
  // that is not an array is stored as it came rather than spread.
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
 * Test seam: empties the cache between tests. The generation counter keeps
 * counting and the clear takes a generation of its own, so a lookup that took
 * its generation before the clear cannot store its answer after it.
 */
export function clearProfileCache(): void {
  profiles.clear();
  generations.clear();
  state.lastGeneration += 1;
  state.clearedGeneration = state.lastGeneration;
}

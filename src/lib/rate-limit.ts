/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Suitable for this app because it runs as a single long-lived Node process
 * (standalone / PM2), so the counter map is shared across requests. It is
 * per-process and resets on restart — not durable and not shared across
 * multiple instances.
 *
 * **Cross-process storage is deliberately deferred, not overlooked.** Backing
 * this with Redis/Upstash would only be correct once the real deployment
 * topology is known: how many worker processes or replicas share a hostname
 * decides both whether the per-process budget is already the intended budget
 * and what the effective global limit would become after consolidation.
 * Adding a shared store before that is settled would silently change the
 * limit every client sees. Revisit when the worker topology is fixed; until
 * then this stays process-local on purpose.
 */

interface WindowState {
  count: number;
  /** Epoch ms when the current window expires. */
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

/**
 * Once the bucket map holds at least this many entries, `rateLimit` becomes
 * eligible to sweep expired ones out before recording a new hit. Keeps a
 * long-lived process from retaining one entry per distinct key forever (e.g.
 * one per client IP ever seen), while skipping sweep cost while the map is
 * small.
 *
 * Exported so tests assert against the real threshold instead of a copy of the
 * number that could quietly stop matching it.
 */
export const pruneThreshold = 1_000;

/**
 * Minimum gap between two sweeps. Size alone is not a sufficient gate: a map
 * of 1,000 *fresh* entries stays over the threshold while the sweep deletes
 * nothing, so a size-only check made every subsequent request pay a full scan,
 * forever, for no eviction. Adding this interval turns the cost into one O(n)
 * scan per interval instead of one per request.
 *
 * One minute because that is the window length both callers use
 * (`rateLimitWindowMs` in `/api/data/[resource]` and
 * `/api/taxonomy-tree/[operation]`). A bucket becomes prunable at most one
 * window after its last hit, so sweeping on the same cadence bounds how long
 * an expired bucket survives physically at roughly one extra window — while a
 * shorter cadence would buy no memory back, because nothing can have expired
 * yet.
 *
 * Note this bounds *physical* eviction only. Logical expiry is unaffected:
 * `rateLimit` still compares `now` against the bucket's own `resetAt` on every
 * call, so a stale bucket never grants or denies a request incorrectly while
 * it waits to be swept.
 */
export const pruneIntervalMs = 60_000;

/** Epoch ms before which no sweep runs. 0 so the first eligible call sweeps. */
let nextPruneAt = 0;

function pruneExpiredBuckets(now: number): void {
  for (const [key, state] of buckets) {
    if (now >= state.resetAt) buckets.delete(key);
  }
}

/**
 * Records a hit for `key` and reports whether it is within the allowed budget.
 *
 * @param key    Identifier to bucket by (e.g. client IP + route).
 * @param limit  Max requests permitted per window.
 * @param windowMs  Window length in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= pruneThreshold && now >= nextPruneAt) {
    pruneExpiredBuckets(now);
    // Scheduled from `now` rather than from the previous deadline: the point
    // is to cap how often a request pays for a scan, not to keep a fixed
    // wall-clock rhythm through an idle period.
    nextPruneAt = now + pruneIntervalMs;
  }
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Whether `key` currently has a tracked bucket. Exposed for tests that verify
 * expired buckets get physically pruned rather than retained for the life of
 * the process — and, since the sweep is now gated by
 * {@link pruneIntervalMs}, that a sweep is *skipped* between deadlines. That
 * distinction cannot be observed from `rateLimit`'s own return value, which
 * reports logical expiry either way.
 *
 * Kept narrow on purpose: one boolean about one key. It exposes no bucket
 * count, no reset control, and not the map itself.
 */
export function hasRateLimitBucket(key: string): boolean {
  return buckets.has(key);
}

/**
 * Best-effort client IP from proxy headers, falling back to "unknown".
 * The app sits behind a proxy (see src/proxy.ts), so x-forwarded-for is the
 * authoritative source.
 *
 * **Trusted-proxy hop selection is deliberately deferred, not overlooked.**
 * Taking the first `x-forwarded-for` entry trusts the whole chain, so a client
 * that sends its own `x-forwarded-for` can choose its own rate-limit bucket.
 * The correct fix is to count back a fixed number of hops from the right — but
 * that number *is* the deployment's reverse-proxy depth, and guessing it is
 * worse than trusting the chain: too few hops buckets every caller behind the
 * proxy together (one shared budget for the whole internet), too many reads an
 * attacker-supplied value anyway. Settle the reverse-proxy topology first,
 * then change this; do not change it before.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // First entry is the original client; the rest are proxy hops.
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** In-memory fixed-window rate limiter; per-process, so counters reset on restart and are not shared across instances. */

interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

/** Map size at which `rateLimit` starts sweeping expired buckets; exported so tests use the real value. */
export const pruneThreshold = 1_000;

/** Minimum gap between sweeps, so a map of unexpired buckets does not trigger a full scan on every request. */
export const pruneIntervalMs = 60_000;

let nextPruneAt = 0;

function pruneExpiredBuckets(now: number): void {
  for (const [key, state] of buckets) {
    if (now >= state.resetAt) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= pruneThreshold && now >= nextPruneAt) {
    pruneExpiredBuckets(now);
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

/** Test-only: whether `key` still has a bucket, to tell physical pruning from logical expiry. */
export function hasRateLimitBucket(key: string): boolean {
  return buckets.has(key);
}

/** Client IP from x-forwarded-for (first entry, which a client can spoof until the proxy hop depth is settled), else "unknown". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

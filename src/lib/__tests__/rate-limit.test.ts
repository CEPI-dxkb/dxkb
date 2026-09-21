import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rateLimit,
  clientIp,
  hasRateLimitBucket,
  pruneIntervalMs,
  pruneThreshold,
} from "@/lib/rate-limit";

/**
 * The bucket map and the prune deadline are module-level state, so the
 * cadence tests below — which have to fill the map past `pruneThreshold` and
 * then reason about *when* the next sweep is allowed — load their own copy of
 * the module instead of sharing one with each other or with the tests above.
 * This is why the limiter needs no test-only reset export.
 */
async function freshLimiter(): Promise<typeof import("@/lib/rate-limit")> {
  vi.resetModules();
  return import("@/lib/rate-limit");
}

/** Fills a fresh limiter's map to exactly `pruneThreshold` live entries. */
function fillToThreshold(
  limiter: typeof import("@/lib/rate-limit"),
  prefix: string,
): void {
  for (let i = 0; i < pruneThreshold; i++) {
    limiter.rateLimit(`${prefix}-${String(i)}`, 5, 60_000);
  }
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit then blocks", () => {
    const key = "limit-boundary";
    expect(rateLimit(key, 3, 1000)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rateLimit(key, 3, 1000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimit(key, 3, 1000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(rateLimit(key, 3, 1000)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("resets after the window elapses", () => {
    const key = "window-reset";
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, 1, 1000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = "independent-a";
    const b = "independent-b";
    rateLimit(a, 1, 1000);
    expect(rateLimit(a, 1, 1000).allowed).toBe(false);
    expect(rateLimit(b, 1, 1000).allowed).toBe(true);
  });

  it("prunes expired buckets once the map grows large, instead of retaining every key forever", () => {
    const target = "prune-target";
    rateLimit(target, 1, 1000);
    expect(hasRateLimitBucket(target)).toBe(true);

    // Expire the target's window without touching it again.
    vi.advanceTimersByTime(1001);

    // Grow the map past the internal prune threshold with fresh (still valid)
    // keys. This forces rateLimit's opportunistic sweep to run at least once,
    // which should find and evict the now-expired target bucket rather than
    // leaving it tracked for the life of the process.
    for (let i = 0; i < pruneThreshold; i++) {
      rateLimit(`prune-filler-${String(i)}`, 5, 60_000);
    }

    expect(hasRateLimitBucket(target)).toBe(false);
  });
});

/**
 * The sweep is gated on map size **and** elapsed time. Size alone was the
 * defect: a map of `pruneThreshold` *fresh* entries stays over the threshold
 * while the sweep deletes nothing, so every subsequent request paid a full
 * O(n) scan, forever, for no eviction.
 *
 * `hasRateLimitBucket` is what makes the gate observable at all. A *skipped*
 * sweep and a *performed* sweep are indistinguishable from `rateLimit`'s own
 * return value, which compares against each bucket's `resetAt` either way — so
 * an expired bucket is reported as reset whether or not it is still physically
 * in the map.
 */
describe("rateLimit prune cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("skips the sweep between deadlines, then resumes once the interval elapses", async () => {
    const limiter = await freshLimiter();
    // Fill to the threshold, then let the first eligible call spend its sweep.
    // From here the size gate is open and `nextPruneAt` is one interval away.
    fillToThreshold(limiter, "fresh");
    limiter.rateLimit("first-eligible-call", 5, 60_000);

    // A bucket that expires *after* that sweep and is then never touched
    // again. Never touching it is load-bearing: any later call that records
    // this key recreates the bucket, so `hasRateLimitBucket` would report
    // `true` whether or not a sweep ran in between, and the first assertion
    // below would pass under the old size-only gate too. The key's name says
    // so, because an earlier version of this test did exactly that and proved
    // nothing.
    limiter.rateLimit("untouched-after-expiry", 1, 1_000);
    vi.advanceTimersByTime(1_001);

    limiter.rateLimit("probe", 5, 60_000);

    // Physically retained. The map is over the size gate and this bucket is
    // expired, so a size-only gate would have swept it on this very call; it
    // survives only because the interval has not elapsed. **This assertion is
    // the one that fails when the `now >= nextPruneAt` conjunct is removed.**
    expect(limiter.hasRateLimitBucket("untouched-after-expiry")).toBe(true);

    // Past the deadline the gate reopens and the next call sweeps.
    vi.advanceTimersByTime(pruneIntervalMs);
    limiter.rateLimit("probe-after-interval", 5, 60_000);

    // **This assertion is the one that fails when the sweep stops running at
    // all.** The two together are the whole cadence contract, which is why
    // they share a test rather than sitting in one test and a prefix of it.
    expect(limiter.hasRateLimitBucket("untouched-after-expiry")).toBe(false);
  });

  it("does not sweep below the threshold however much time passes", async () => {
    const limiter = await freshLimiter();
    limiter.rateLimit("lonely-expired", 1, 1_000);
    vi.advanceTimersByTime(pruneIntervalMs * 10);

    limiter.rateLimit("lonely-probe", 5, 60_000);

    // Size is still the outer gate: a two-entry map is not worth scanning, and
    // the stale entry costs nothing until the map is actually large.
    expect(limiter.hasRateLimitBucket("lonely-expired")).toBe(true);
  });

  // Physical retention must never change an answer. This is the half of the
  // contract the size/time gate is allowed to relax.
  it("still expires a retained bucket logically while it waits to be swept", async () => {
    const limiter = await freshLimiter();
    fillToThreshold(limiter, "fresh");
    limiter.rateLimit("first-eligible-call", 5, 60_000);

    limiter.rateLimit("budget-spent", 1, 1_000);
    expect(limiter.rateLimit("budget-spent", 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    // Not swept yet — "skips the sweep between deadlines…" above proves that
    // for an identical setup — but the window is over, so the next request is
    // allowed on a fresh count.
    expect(limiter.rateLimit("budget-spent", 1, 1_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    expect(clientIp(req)).toBe("198.51.100.5");
  });

  it("returns 'unknown' when no ip headers are present", () => {
    const req = new Request("https://example.com");
    expect(clientIp(req)).toBe("unknown");
  });
});

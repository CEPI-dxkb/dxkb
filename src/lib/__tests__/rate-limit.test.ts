import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rateLimit,
  clientIp,
  hasRateLimitBucket,
  pruneIntervalMs,
  pruneThreshold,
} from "@/lib/rate-limit";

/** Module-level bucket state: the cadence tests load their own module copy, so the limiter needs no test-only reset export. */
async function freshLimiter(): Promise<typeof import("@/lib/rate-limit")> {
  vi.resetModules();
  return import("@/lib/rate-limit");
}

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

    vi.advanceTimersByTime(1001);

    // Grow the map past `pruneThreshold` with fresh keys to force the opportunistic sweep.
    for (let i = 0; i < pruneThreshold; i++) {
      rateLimit(`prune-filler-${String(i)}`, 5, 60_000);
    }

    expect(hasRateLimitBucket(target)).toBe(false);
  });
});

/** The sweep is gated on map size and elapsed time; `hasRateLimitBucket` makes it observable, since `rateLimit`'s return value is the same whether or not an expired bucket is still in the map. */
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
    fillToThreshold(limiter, "fresh");
    limiter.rateLimit("first-eligible-call", 5, 60_000);

    // Never touching it again is load-bearing: a later call recording this key would recreate the bucket and pass under a size-only gate too.
    limiter.rateLimit("untouched-after-expiry", 1, 1_000);
    vi.advanceTimersByTime(1_001);

    limiter.rateLimit("probe", 5, 60_000);

    // Physically retained only because the interval has not elapsed; fails if the `now >= nextPruneAt` conjunct is removed.
    expect(limiter.hasRateLimitBucket("untouched-after-expiry")).toBe(true);

    vi.advanceTimersByTime(pruneIntervalMs);
    limiter.rateLimit("probe-after-interval", 5, 60_000);

    // Fails if the sweep stops running at all.
    expect(limiter.hasRateLimitBucket("untouched-after-expiry")).toBe(false);
  });

  it("does not sweep below the threshold however much time passes", async () => {
    const limiter = await freshLimiter();
    limiter.rateLimit("lonely-expired", 1, 1_000);
    vi.advanceTimersByTime(pruneIntervalMs * 10);

    limiter.rateLimit("lonely-probe", 5, 60_000);

    expect(limiter.hasRateLimitBucket("lonely-expired")).toBe(true);
  });

  // Physical retention must never change an answer.
  it("still expires a retained bucket logically while it waits to be swept", async () => {
    const limiter = await freshLimiter();
    fillToThreshold(limiter, "fresh");
    limiter.rateLimit("first-eligible-call", 5, 60_000);

    limiter.rateLimit("budget-spent", 1, 1_000);
    expect(limiter.rateLimit("budget-spent", 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
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

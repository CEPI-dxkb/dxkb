import { clearAllSharedCaches, createSharedCache } from "@/lib/shared-cache";

class TestUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TestUpstreamError";
  }
}

function timedOut(message = "The data service did not respond (timed out after 20 s)."): TestUpstreamError {
  return new TestUpstreamError(message, 504);
}

function maintenance(): TestUpstreamError {
  return new TestUpstreamError("The data service is unavailable (HTTP 503).", 503);
}

function notFound(): TestUpstreamError {
  return new TestUpstreamError("No such taxon.", 404);
}

function malformed(): TestUpstreamError {
  return new TestUpstreamError("Malformed data service response.", 502);
}

const cacheError = (error: unknown) => error instanceof TestUpstreamError;
const isNotFound = (error: unknown) =>
  error instanceof TestUpstreamError && error.status === 404;
const trips = (error: unknown) =>
  error instanceof TestUpstreamError && (error.status === 503 || error.status === 504);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

type Loader = (key: string, previous: string | undefined) => Promise<string>;

const freshMs = 60_000;
const retryMs = 10_000;

function plainCache(load: Loader, name = "taxa") {
  return createSharedCache<string, string>({ name, load, freshMs, retryMs, cacheError });
}

function breakerCache(
  load: Loader,
  breaker: { failureThreshold?: number; windowMs?: number; openMs?: number } = {},
  name = "taxa",
) {
  return createSharedCache<string, string>({
    name,
    load,
    freshMs,
    retryMs,
    cacheError,
    breaker: { trips, ...breaker },
  });
}

/** Opens a default breaker with two tripping failures on keys `down-1` and `down-2`, returning the opening error. */
async function openBreaker(
  cache: { get(key: string): Promise<string> },
  load: ReturnType<typeof vi.fn<Loader>>,
): Promise<TestUpstreamError> {
  const first = timedOut("first timeout");
  const second = timedOut("second timeout");
  load.mockRejectedValueOnce(first).mockRejectedValueOnce(second);
  await expect(cache.get("down-1")).rejects.toBe(first);
  await expect(cache.get("down-2")).rejects.toBe(second);
  return second;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createSharedCache per key", () => {
  it("shares one load among concurrent callers of a key never loaded", async () => {
    const pending = deferred<string>();
    const load = vi.fn<Loader>(() => pending.promise);
    const cache = plainCache(load);

    const first = cache.get("a");
    const second = cache.get("a");
    pending.resolve("a-value");

    await expect(first).resolves.toBe("a-value");
    await expect(second).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("a", undefined);
  });

  it("returns a fresh value without calling the upstream", async () => {
    const load = vi.fn<Loader>().mockResolvedValueOnce("a-value");
    const cache = plainCache(load);

    await expect(cache.get("a")).resolves.toBe("a-value");
    advance(freshMs - 1);
    await expect(cache.get("a")).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("returns a stale value at once and refreshes it once in the background", async () => {
    const refresh = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockImplementationOnce(() => refresh.promise);
    const cache = plainCache(load);

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("a", "v1");

    refresh.resolve("v2");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("takes the fresh window from the value when freshMs is a function", async () => {
    const load = vi.fn<Loader>((key) => Promise.resolve(key));
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs: (value) => (value === "short" ? 1_000 : 60_000),
      retryMs,
    });

    await cache.get("short");
    await cache.get("long");
    advance(1_000);
    await cache.get("short");
    await cache.get("long");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["short", "long", "short"]);
  });

  it.each([
    ["an outage", timedOut(), false],
    ["a bug", new TypeError("x is undefined"), true],
  ])(
    "keeps the old value when a refresh fails with %s, and retries after retryMs",
    async (_label, error, logged) => {
      const load = vi
        .fn<Loader>()
        .mockResolvedValueOnce("v1")
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("v2");
      const cache = plainCache(load);

      await cache.get("a");
      advance(freshMs);
      await expect(cache.get("a")).resolves.toBe("v1");
      await settle();
      if (logged) {
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          "shared-cache taxa: refresh of a failed",
          error,
        );
      } else {
        expect(console.error).not.toHaveBeenCalled();
      }

      advance(retryMs - 1);
      await expect(cache.get("a")).resolves.toBe("v1");
      expect(load).toHaveBeenCalledTimes(2);

      advance(1);
      await expect(cache.get("a")).resolves.toBe("v1");
      expect(load).toHaveBeenCalledTimes(3);
      await settle();
      await expect(cache.get("a")).resolves.toBe("v2");
    },
  );

  it("replaces the value with a refresh's error that replacesValue accepts, served unlogged until retryMs", async () => {
    const gone = notFound();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(gone)
      .mockResolvedValueOnce("v2");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      replacesValue: isNotFound,
    });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).rejects.toBe(gone);

    advance(retryMs - 1);
    await expect(cache.get("a")).rejects.toBe(gone);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();

    advance(1);
    await expect(cache.get("a")).rejects.toBe(gone);
    expect(load).toHaveBeenCalledTimes(3);
    expect(load).toHaveBeenLastCalledWith("a", undefined);
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
  });

  it("serves the stale value while the replacing refresh runs, then its error", async () => {
    const refresh = deferred<string>();
    const gone = notFound();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockImplementationOnce(() => refresh.promise);
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      replacesValue: isNotFound,
    });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);

    refresh.reject(gone);
    await settle();
    await expect(cache.get("a")).rejects.toBe(gone);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the value when a refresh fails with a cacheable error replacesValue rejects", async () => {
    const replacesValue = vi.fn(isNotFound);
    const outage = timedOut();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(outage)
      .mockResolvedValueOnce("v2");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      replacesValue,
    });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(replacesValue).toHaveBeenCalledExactlyOnceWith(outage);
    expect(console.error).not.toHaveBeenCalled();

    advance(retryMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenLastCalledWith("a", "v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
  });

  it("treats a throwing replacesValue as false, keeping the value, and logs it", async () => {
    const predicateBug = new TypeError("replacesValue is broken");
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce("v2");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      replacesValue: () => {
        throw predicateBug;
      },
    });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "shared-cache taxa: replacesValue threw",
      predicateBug,
    );

    advance(retryMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
  });

  it.each([
    ["not given", undefined],
    ["rejecting the error", () => false],
  ])(
    "keeps the value and logs the refresh failure with cacheError %s, whatever replacesValue says",
    async (_label, cacheErrorOption) => {
      const replacesValue = vi.fn(() => true);
      const gone = notFound();
      const load = vi
        .fn<Loader>()
        .mockResolvedValueOnce("v1")
        .mockRejectedValueOnce(gone)
        .mockResolvedValueOnce("v2");
      const cache = createSharedCache<string, string>({
        name: "taxa",
        load,
        freshMs,
        retryMs,
        cacheError: cacheErrorOption,
        replacesValue,
      });

      await cache.get("a");
      advance(freshMs);
      await expect(cache.get("a")).resolves.toBe("v1");
      await settle();
      await expect(cache.get("a")).resolves.toBe("v1");
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "shared-cache taxa: refresh of a failed",
        gone,
      );
      expect(replacesValue).not.toHaveBeenCalled();

      advance(retryMs);
      await expect(cache.get("a")).resolves.toBe("v1");
      await settle();
      await expect(cache.get("a")).resolves.toBe("v2");
    },
  );

  it("rethrows a fresh cached failure without calling the upstream", async () => {
    const error = timedOut();
    const load = vi.fn<Loader>().mockRejectedValueOnce(error);
    const cache = plainCache(load);

    await expect(cache.get("a")).rejects.toBe(error);
    advance(retryMs - 1);
    await expect(cache.get("a")).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("rethrows a stale cached failure at once and retries it once in the background", async () => {
    const error = timedOut();
    const retry = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(error)
      .mockImplementationOnce(() => retry.promise);
    const cache = plainCache(load);

    await expect(cache.get("a")).rejects.toBe(error);
    advance(retryMs);
    await expect(cache.get("a")).rejects.toBe(error);
    await expect(cache.get("a")).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("a", undefined);

    retry.resolve("a-value");
    await settle();
    await expect(cache.get("a")).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("caches the retry's own error when a stale cached failure fails again", async () => {
    const first = timedOut("first");
    const second = maintenance();
    const load = vi.fn<Loader>().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    const cache = plainCache(load);

    await expect(cache.get("a")).rejects.toBe(first);
    advance(retryMs);
    await expect(cache.get("a")).rejects.toBe(first);
    await settle();
    await expect(cache.get("a")).rejects.toBe(second);
    advance(retryMs - 1);
    await expect(cache.get("a")).rejects.toBe(second);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops a stale cached failure whose retry fails with an uncacheable error", async () => {
    const outage = timedOut();
    const bug = new TypeError("x is undefined");
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(bug)
      .mockResolvedValueOnce("a-value");
    const cache = plainCache(load);

    await expect(cache.get("a")).rejects.toBe(outage);
    advance(retryMs);
    await expect(cache.get("a")).rejects.toBe(outage);
    await settle();
    expect(console.error).toHaveBeenCalledWith("shared-cache taxa: refresh of a failed", bug);

    await expect(cache.get("a")).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not log a cacheable background failure, which is the loader's to log", async () => {
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(notFound());
    const cache = plainCache(load);

    await cache.get("a");
    await expect(cache.get("b")).rejects.toBeInstanceOf(TestUpstreamError);
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await expect(cache.get("b")).rejects.toBeInstanceOf(TestUpstreamError);
    await settle();

    expect(load).toHaveBeenCalledTimes(4);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs a background failure that is not cacheable", async () => {
    const error = timedOut();
    const load = vi.fn<Loader>().mockResolvedValueOnce("v1").mockRejectedValueOnce(error);
    const cache = createSharedCache<string, string>({ name: "taxa", load, freshMs, retryMs });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();

    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "shared-cache taxa: refresh of a failed",
      error,
    );
  });

  it("propagates an uncacheable error and caches nothing, so the next caller retries", async () => {
    const bug = new TypeError("x is undefined");
    const load = vi.fn<Loader>().mockRejectedValueOnce(bug).mockResolvedValueOnce("a-value");
    const cache = plainCache(load);

    await expect(cache.get("a")).rejects.toBe(bug);
    await expect(cache.get("a")).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("treats a throwing freshMs as an uncacheable load error", async () => {
    const bug = new RangeError("bad fresh window");
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("bad")
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("bad")
      .mockResolvedValueOnce("v2");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs: (value) => {
        if (value === "bad") throw bug;
        return freshMs;
      },
      retryMs,
      cacheError: () => true,
    });

    await expect(cache.get("a")).rejects.toBe(bug);
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);

    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    expect(console.error).toHaveBeenCalledWith("shared-cache taxa: refresh of a failed", bug);
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(3);

    advance(retryMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("treats a freshMs of %s like a throwing one", async (label, badMs) => {
    const bug = new RangeError(`shared-cache taxa: freshMs is ${label}, not a finite number`);
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("bad")
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("bad")
      .mockResolvedValueOnce("v2");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs: (value) => (value === "bad" ? badMs : freshMs),
      retryMs,
      cacheError: () => true,
    });

    await expect(cache.get("a")).rejects.toEqual(bug);
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);

    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "shared-cache taxa: refresh of a failed",
      bug,
    );
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(3);

    advance(retryMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
  });

  it("treats a throwing cacheError as false and logs it", async () => {
    const error = timedOut();
    const predicateBug = new TypeError("cacheError is broken");
    const load = vi.fn<Loader>().mockRejectedValueOnce(error).mockResolvedValueOnce("a-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError: () => {
        throw predicateBug;
      },
    });

    await expect(cache.get("a")).rejects.toBe(error);
    expect(console.error).toHaveBeenCalledWith("shared-cache taxa: cacheError threw", predicateBug);
    await expect(cache.get("a")).resolves.toBe("a-value");
  });

  it("caches no failure when cacheError is not given", async () => {
    const error = timedOut();
    const load = vi.fn<Loader>().mockRejectedValueOnce(error).mockResolvedValueOnce("a-value");
    const cache = createSharedCache<string, string>({ name: "taxa", load, freshMs, retryMs });

    await expect(cache.get("a")).rejects.toBe(error);
    await expect(cache.get("a")).resolves.toBe("a-value");
  });

  it("rejects, rather than throwing, when the loader throws synchronously", async () => {
    const bug = new TypeError("x is undefined");
    const cache = plainCache(() => {
      throw bug;
    });

    const pending = cache.get("a");
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toBe(bug);
  });
});

describe("createSharedCache LRU bound", () => {
  it("evicts the least recently used key beyond maxEntries", async () => {
    const load = vi.fn<Loader>((key) => Promise.resolve(`${key}-value`));
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      maxEntries: 2,
    });

    await cache.get("a");
    await cache.get("b");
    await cache.get("a");
    await cache.get("c");
    await cache.get("a");
    await cache.get("b");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "b", "c", "b"]);
  });

  it("holds 500 entries by default", async () => {
    const load = vi.fn((key: number) => Promise.resolve(key * 2));
    const cache = createSharedCache<number, number>({ name: "numbers", load, freshMs, retryMs });

    for (let key = 0; key <= 500; key += 1) await cache.get(key);
    await expect(cache.get(500)).resolves.toBe(1_000);
    expect(load).toHaveBeenCalledTimes(501);
    await expect(cache.get(0)).resolves.toBe(0);
    expect(load).toHaveBeenCalledTimes(502);
  });

  it("never evicts a key whose load is running, so a later caller shares that load", async () => {
    const pending = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue("b-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      maxEntries: 1,
    });

    const first = cache.get("a");
    const other = cache.get("b");
    const second = cache.get("a");
    pending.resolve("a-value");

    await expect(first).resolves.toBe("a-value");
    await expect(second).resolves.toBe("a-value");
    await expect(other).resolves.toBe("b-value");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "b"]);
  });

  it("trims back to maxEntries as the loads settle, evicting the oldest settled entry", async () => {
    const pending = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue("b-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      maxEntries: 1,
    });

    const first = cache.get("a");
    await expect(cache.get("b")).resolves.toBe("b-value");
    const second = cache.get("a");
    pending.resolve("a-value");
    await Promise.all([first, second]);

    await expect(cache.get("a")).resolves.toBe("a-value");
    expect(load).toHaveBeenCalledTimes(2);
    await expect(cache.get("b")).resolves.toBe("b-value");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "b", "b"]);
  });

  it("trims as a failed load settles, too", async () => {
    const pending = deferred<string>();
    const outage = timedOut();
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(() => pending.promise)
      .mockRejectedValueOnce(outage)
      .mockResolvedValue("b-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      maxEntries: 1,
    });

    const first = cache.get("a");
    await expect(cache.get("b")).rejects.toBe(outage);
    pending.resolve("a-value");
    await first;

    await expect(cache.get("a")).resolves.toBe("a-value");
    await expect(cache.get("b")).resolves.toBe("b-value");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "b", "b"]);
  });

  it("never evicts a key whose background refresh is running", async () => {
    const refresh = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockImplementationOnce(() => refresh.promise)
      .mockResolvedValue("b-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      maxEntries: 1,
    });

    await cache.get("a");
    advance(freshMs);
    await expect(cache.get("a")).resolves.toBe("v1");
    await expect(cache.get("b")).resolves.toBe("b-value");
    await expect(cache.get("a")).resolves.toBe("v1");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "a", "b"]);

    refresh.resolve("v2");
    await settle();
    await expect(cache.get("a")).resolves.toBe("v2");
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe("createSharedCache E2E bypass", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_MOCK_ENABLED", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads on every call, without coalescing, a previous value or a cached failure", async () => {
    const error = timedOut();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2")
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("v3")
      .mockResolvedValueOnce("v4");
    const cache = breakerCache(load);

    await expect(cache.get("a")).resolves.toBe("v1");
    await expect(cache.get("a")).resolves.toBe("v2");
    await expect(cache.get("a")).rejects.toBe(error);
    await expect(Promise.all([cache.get("a"), cache.get("a")])).resolves.toEqual(["v3", "v4"]);
    expect(load).toHaveBeenCalledTimes(5);
    for (const call of load.mock.calls) expect(call).toEqual(["a", undefined]);
  });

  it("reads the flag on every call", async () => {
    vi.stubEnv("E2E_MOCK_ENABLED", "");
    const load = vi.fn<Loader>().mockResolvedValueOnce("cached").mockResolvedValueOnce("live");
    const cache = plainCache(load);

    await expect(cache.get("a")).resolves.toBe("cached");
    vi.stubEnv("E2E_MOCK_ENABLED", "1");
    await expect(cache.get("a")).resolves.toBe("live");
  });
});

describe("createSharedCache background failures", () => {
  const unhandled = vi.fn();

  beforeEach(() => {
    process.on("unhandledRejection", unhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", unhandled);
    unhandled.mockReset();
  });

  it("never turns a failed background refresh into an unhandled rejection", async () => {
    const outage = timedOut();
    const load = vi
      .fn<Loader>()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(new TypeError("refresh bug"))
      .mockRejectedValueOnce(new TypeError("retry bug"));
    const cache = plainCache(load);

    await cache.get("value");
    await expect(cache.get("failure")).rejects.toBe(outage);
    advance(freshMs);
    await expect(cache.get("value")).resolves.toBe("v1");
    await expect(cache.get("failure")).rejects.toBe(outage);
    await settle();
    advance(retryMs);
    await expect(cache.get("value")).resolves.toBe("v1");
    await expect(cache.get("failure")).rejects.toBe(outage);
    await settle();

    expect(load).toHaveBeenCalledTimes(6);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("createSharedCache circuit breaker", () => {
  it("opens after two tripping failures within 60 s and fails cold keys fast with the opening error", async () => {
    const first = timedOut("first timeout");
    const second = timedOut("second timeout");
    const load = vi.fn<Loader>().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    const cache = breakerCache(load);

    await expect(cache.get("down-1")).rejects.toBe(first);
    advance(59_999);
    await expect(cache.get("down-2")).rejects.toBe(second);
    expect(console.error).toHaveBeenCalledWith(
      "shared-cache taxa: upstream marked down for 30 s: second timeout",
      { key: "down-2" },
    );

    await expect(cache.get("cold-1")).rejects.toBe(second);
    await expect(cache.get("cold-2")).rejects.toBe(second);
    expect(load).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("stays closed when tripping failures are spread beyond the window", async () => {
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce("cold-value");
    const cache = breakerCache(load);

    await expect(cache.get("down-1")).rejects.toThrow();
    advance(60_000);
    await expect(cache.get("down-2")).rejects.toThrow();
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("honours a custom threshold, window and open period", async () => {
    const third = maintenance();
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(third)
      .mockResolvedValueOnce("probe-value");
    const cache = breakerCache(load, { failureThreshold: 3, windowMs: 10_000, openMs: 5_000 });

    await expect(cache.get("down-1")).rejects.toThrow();
    advance(4_000);
    await expect(cache.get("down-2")).rejects.toThrow();
    advance(4_000);
    await expect(cache.get("down-3")).rejects.toBe(third);
    expect(console.error).toHaveBeenCalledWith(
      `shared-cache taxa: upstream marked down for 5 s: ${third.message}`,
      { key: "down-3" },
    );

    advance(4_999);
    await expect(cache.get("cold")).rejects.toBe(third);
    advance(1);
    await expect(cache.get("cold")).resolves.toBe("probe-value");
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("serves a stale value without refreshing it while open", async () => {
    const load = vi.fn<Loader>().mockResolvedValueOnce("v1");
    const cache = breakerCache(load);

    await cache.get("stale");
    advance(freshMs);
    await openBreaker(cache, load);
    await expect(cache.get("stale")).resolves.toBe("v1");
    await expect(cache.get("stale")).resolves.toBe("v1");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("still rethrows a key's own fresh cached failure while open", async () => {
    const own = maintenance();
    const opening = timedOut();
    const load = vi.fn<Loader>().mockRejectedValueOnce(own).mockRejectedValueOnce(opening);
    const cache = breakerCache(load);

    await expect(cache.get("own")).rejects.toBe(own);
    await expect(cache.get("down")).rejects.toBe(opening);
    await expect(cache.get("cold")).rejects.toBe(opening);
    await expect(cache.get("own")).rejects.toBe(own);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("holds a stale cached failure's retry while open and lets it be the probe after", async () => {
    const own = maintenance();
    const opening = timedOut();
    const load = vi.fn<Loader>().mockRejectedValueOnce(own).mockRejectedValueOnce(opening);
    const cache = breakerCache(load);

    await expect(cache.get("own")).rejects.toBe(own);
    await expect(cache.get("down")).rejects.toBe(opening);
    advance(retryMs);
    await expect(cache.get("own")).rejects.toBe(own);
    expect(load).toHaveBeenCalledTimes(2);

    advance(30_000 - retryMs);
    load.mockResolvedValueOnce("own-value");
    await expect(cache.get("own")).rejects.toBe(own);
    expect(load).toHaveBeenCalledTimes(3);
    await settle();
    await expect(cache.get("own")).resolves.toBe("own-value");
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");
  });

  it("lets one probe through after the open period while other cold keys fail fast and stale keys wait", async () => {
    const probe = deferred<string>();
    const load = vi.fn<Loader>().mockResolvedValueOnce("stale-v1");
    const cache = breakerCache(load);

    await cache.get("stale");
    const opening = await openBreaker(cache, load);
    advance(29_999);
    await expect(cache.get("cold-1")).rejects.toBe(opening);
    expect(load).toHaveBeenCalledTimes(3);

    advance(freshMs);
    load.mockImplementationOnce(() => probe.promise);
    const probing = cache.get("probe");
    expect(load).toHaveBeenCalledTimes(4);
    await expect(cache.get("cold-1")).rejects.toBe(opening);
    await expect(cache.get("stale")).resolves.toBe("stale-v1");
    expect(load).toHaveBeenCalledTimes(4);

    probe.resolve("probe-value");
    await expect(probing).resolves.toBe("probe-value");
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");

    load.mockResolvedValueOnce("cold-value").mockResolvedValueOnce("stale-v2");
    await expect(cache.get("cold-1")).resolves.toBe("cold-value");
    await expect(cache.get("stale")).resolves.toBe("stale-v1");
    expect(load).toHaveBeenLastCalledWith("stale", "stale-v1");
    await settle();
    await expect(cache.get("stale")).resolves.toBe("stale-v2");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("reopens for another open period when the probe trips, failing fast with the probe's error and logging each reopen", async () => {
    const load = vi.fn<Loader>();
    const cache = breakerCache(load);

    await openBreaker(cache, load);
    advance(30_000);
    const probeError = maintenance();
    load.mockRejectedValueOnce(probeError);
    await expect(cache.get("probe")).rejects.toBe(probeError);
    expect(console.error).toHaveBeenLastCalledWith(
      `shared-cache taxa: upstream still down, retrying in 30 s: ${probeError.message}`,
      { key: "probe" },
    );
    await expect(cache.get("cold")).rejects.toBe(probeError);
    advance(29_999);
    await expect(cache.get("cold")).rejects.toBe(probeError);
    expect(load).toHaveBeenCalledTimes(3);

    advance(1);
    const secondProbeError = timedOut("still timing out");
    load.mockRejectedValueOnce(secondProbeError);
    await expect(cache.get("cold")).rejects.toBe(secondProbeError);
    expect(console.error).toHaveBeenLastCalledWith(
      "shared-cache taxa: upstream still down, retrying in 30 s: still timing out",
      { key: "cold" },
    );
    expect(console.error).toHaveBeenCalledTimes(3);

    advance(30_000);
    load.mockResolvedValueOnce("other-value");
    await expect(cache.get("other")).resolves.toBe("other-value");
    expect(load).toHaveBeenCalledTimes(5);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a 404", notFound()],
    ["a bug", new TypeError("x is undefined")],
  ])("closes the breaker when the probe settles with %s", async (_label, error) => {
    const load = vi.fn<Loader>();
    const cache = breakerCache(load);

    await openBreaker(cache, load);
    advance(30_000);
    load.mockRejectedValueOnce(error);
    await expect(cache.get("probe")).rejects.toBe(error);
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");

    load.mockResolvedValueOnce("cold-value");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
  });

  it("keeps a running probe past the LRU bound, so its key shares it, then settles the breaker and trims it", async () => {
    const probe = deferred<string>();
    const load = vi.fn<Loader>();
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      maxEntries: 0,
      breaker: { trips },
    });

    const opening = await openBreaker(cache, load);
    advance(30_000);
    load.mockImplementationOnce(() => probe.promise);
    const probing = cache.get("probe");
    const sharing = cache.get("probe");
    await expect(cache.get("cold")).rejects.toBe(opening);

    probe.resolve("probe-value");
    await expect(probing).resolves.toBe("probe-value");
    await expect(sharing).resolves.toBe("probe-value");
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");
    load.mockResolvedValueOnce("cold-value").mockResolvedValueOnce("probe-again");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    await expect(cache.get("probe")).resolves.toBe("probe-again");
    expect(load).toHaveBeenCalledTimes(5);
  });

  it("leaves the live breaker alone when the probe's cache was cleared while it ran", async () => {
    const probe = deferred<string>();
    const load = vi.fn<Loader>();
    const cache = breakerCache(load);

    await openBreaker(cache, load);
    advance(30_000);
    load.mockImplementationOnce(() => probe.promise);
    const probing = cache.get("probe");
    cache.clear();

    load.mockResolvedValueOnce("cold-value");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    const late = timedOut("late probe timeout");
    probe.reject(late);
    await expect(probing).rejects.toBe(late);

    load.mockRejectedValueOnce(timedOut()).mockResolvedValueOnce("after-value");
    await expect(cache.get("down-3")).rejects.toThrow();
    await expect(cache.get("after")).resolves.toBe("after-value");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("counts a tripping failure toward the threshold even when it is not cacheable", async () => {
    const first = timedOut("first timeout");
    const second = timedOut("second timeout");
    const load = vi.fn<Loader>().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      breaker: { trips },
    });

    await expect(cache.get("down-1")).rejects.toBe(first);
    await expect(cache.get("down-2")).rejects.toBe(second);
    expect(console.error).toHaveBeenCalledWith(
      "shared-cache taxa: upstream marked down for 30 s: second timeout",
      { key: "down-2" },
    );
    await expect(cache.get("down-1")).rejects.toBe(second);
    await expect(cache.get("cold")).rejects.toBe(second);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("treats a throwing freshMs on the probe as a load error that still closes the breaker", async () => {
    const bug = new RangeError("bad fresh window");
    const load = vi.fn<Loader>();
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs: (value) => {
        if (value === "bad") throw bug;
        return freshMs;
      },
      retryMs,
      cacheError,
      breaker: { trips },
    });

    await openBreaker(cache, load);
    advance(30_000);
    load.mockResolvedValueOnce("bad");
    await expect(cache.get("probe")).rejects.toBe(bug);
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");

    load.mockResolvedValueOnce("probe-value").mockResolvedValueOnce("cold-value");
    await expect(cache.get("probe")).resolves.toBe("probe-value");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
  });

  it("passes trips each load's elapsed time, from its start to its settling", async () => {
    const first = malformed();
    const second = malformed();
    const tripsOnElapsed = vi.fn<(error: unknown, elapsedMs: number) => boolean>(
      (_error, elapsedMs) => elapsedMs >= 10_000,
    );
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(() => {
        advance(12_345);
        return Promise.reject(first);
      })
      .mockImplementationOnce(async () => {
        advance(1_000);
        await settle();
        advance(2_000);
        throw second;
      });
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      breaker: { trips: tripsOnElapsed },
    });

    await expect(cache.get("slow")).rejects.toBe(first);
    advance(100_000);
    await expect(cache.get("fast")).rejects.toBe(second);

    expect(tripsOnElapsed.mock.calls).toEqual([
      [first, 12_345],
      [second, 3_000],
    ]);
  });

  it("opens on two slow failures that trips counts by their elapsed time", async () => {
    const load = vi.fn<Loader>(() => {
      advance(10_000);
      return Promise.reject(malformed());
    });
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      breaker: { trips: (_error, elapsedMs) => elapsedMs >= 10_000 },
    });

    await expect(cache.get("slow-1")).rejects.toThrow();
    const opening = await cache.get("slow-2").catch((error: unknown) => error);
    await expect(cache.get("cold")).rejects.toBe(opening);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("treats a throwing trips as false and logs it", async () => {
    const tripsBug = new TypeError("trips is broken");
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce("cold-value");
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      breaker: {
        trips: () => {
          throw tripsBug;
        },
      },
    });

    await expect(cache.get("down-1")).rejects.toThrow();
    await expect(cache.get("down-2")).rejects.toThrow();
    expect(console.error).toHaveBeenCalledWith("shared-cache taxa: breaker.trips threw", tripsBug);
    await expect(cache.get("cold")).resolves.toBe("cold-value");
  });

  it("settles the probe when trips throws on its error", async () => {
    const tripsBug = new TypeError("trips is broken");
    const probeError = maintenance();
    const load = vi.fn<Loader>();
    const cache = createSharedCache<string, string>({
      name: "taxa",
      load,
      freshMs,
      retryMs,
      cacheError,
      breaker: {
        trips: (error) => {
          if (error === probeError) throw tripsBug;
          return trips(error);
        },
      },
    });

    await openBreaker(cache, load);
    advance(30_000);
    load.mockRejectedValueOnce(probeError);
    await expect(cache.get("probe")).rejects.toBe(probeError);
    expect(console.error).toHaveBeenCalledWith("shared-cache taxa: breaker.trips threw", tripsBug);
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");

    load.mockResolvedValueOnce("cold-value");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
  });

  it("lets a stale key's refresh be the half-open probe", async () => {
    const refresh = deferred<string>();
    const load = vi.fn<Loader>().mockResolvedValueOnce("stale-v1");
    const cache = breakerCache(load);

    await cache.get("stale");
    const opening = await openBreaker(cache, load);
    advance(freshMs);
    load.mockImplementationOnce(() => refresh.promise);
    await expect(cache.get("stale")).resolves.toBe("stale-v1");
    expect(load).toHaveBeenLastCalledWith("stale", "stale-v1");
    await expect(cache.get("cold")).rejects.toBe(opening);

    refresh.resolve("stale-v2");
    await settle();
    load.mockResolvedValueOnce("cold-value");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    await expect(cache.get("stale")).resolves.toBe("stale-v2");
    expect(console.info).toHaveBeenCalledWith("shared-cache taxa: upstream marked back up");
  });

  it.each([
    ["a 404", () => Promise.reject(notFound())],
    ["a malformed payload", () => Promise.reject(malformed())],
    ["an uncacheable error", () => Promise.reject(new TypeError("x is undefined"))],
    ["a value", () => Promise.resolve("value")],
  ])("resets the failure count when a load settles with %s", async (_label, outcome) => {
    const load = vi
      .fn<Loader>()
      .mockRejectedValueOnce(timedOut())
      .mockImplementationOnce(outcome)
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce("cold-value");
    const cache = breakerCache(load);

    await expect(cache.get("down-1")).rejects.toThrow();
    await cache.get("answered").catch(() => undefined);
    await expect(cache.get("down-2")).rejects.toThrow();
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("keeps one breaker per cache", async () => {
    const load = vi.fn<Loader>();
    const cache = breakerCache(load);
    const other = breakerCache(vi.fn<Loader>().mockResolvedValueOnce("other-value"), {}, "lineage");

    await openBreaker(cache, load);
    await expect(other.get("cold")).resolves.toBe("other-value");
  });
});

describe("createSharedCache shared state", () => {
  it("shares entries and breaker between caches created with the same name", async () => {
    const firstLoad = vi.fn<Loader>().mockResolvedValueOnce("first-value");
    const secondLoad = vi.fn<Loader>();
    const first = breakerCache(firstLoad, {}, "same");
    const second = breakerCache(secondLoad, {}, "same");

    await expect(first.get("a")).resolves.toBe("first-value");
    await expect(second.get("a")).resolves.toBe("first-value");

    const opening = await openBreaker(first, firstLoad);
    await expect(second.get("cold")).rejects.toBe(opening);
    expect(secondLoad).not.toHaveBeenCalled();
  });

  it("lets a same-named cache without a breaker ignore the shared breaker, so it never holds the probe", async () => {
    const load = vi.fn<Loader>();
    const cache = breakerCache(load, {}, "same");
    const plainLoad = vi.fn<Loader>((key) => Promise.resolve(`${key}-value`));
    const plain = plainCache(plainLoad, "same");

    const opening = await openBreaker(cache, load);
    await expect(plain.get("plain-1")).resolves.toBe("plain-1-value");
    await expect(cache.get("cold")).rejects.toBe(opening);

    advance(30_000);
    await expect(plain.get("plain-2")).resolves.toBe("plain-2-value");
    load.mockResolvedValueOnce("probe-value");
    await expect(cache.get("probe")).resolves.toBe("probe-value");
    expect(console.info).toHaveBeenCalledWith("shared-cache same: upstream marked back up");
  });

  it("keeps its state on globalThis under a registered symbol", async () => {
    await plainCache(() => Promise.resolve("value"), "registered").get("a");
    const registry = (globalThis as unknown as Record<symbol, unknown>)[
      Symbol.for("dxkb.sharedCache.v1")
    ];
    expect(registry).toBeInstanceOf(Map);
    expect((registry as Map<string, unknown>).has("registered")).toBe(true);
  });

  it("clear() resets one cache's entries and breaker and leaves the others", async () => {
    const load = vi.fn<Loader>().mockResolvedValueOnce("v1");
    const cache = breakerCache(load);
    const otherLoad = vi.fn<Loader>().mockResolvedValueOnce("other-v1");
    const other = plainCache(otherLoad, "lineage");

    await cache.get("a");
    await other.get("a");
    await openBreaker(cache, load);
    cache.clear();

    load.mockResolvedValueOnce("v2").mockResolvedValueOnce("cold-value");
    await expect(cache.get("a")).resolves.toBe("v2");
    await expect(cache.get("cold")).resolves.toBe("cold-value");
    await expect(other.get("a")).resolves.toBe("other-v1");
    expect(otherLoad).toHaveBeenCalledTimes(1);
  });

  it("clearAllSharedCaches resets every cache", async () => {
    const load = vi.fn<Loader>((key) => Promise.resolve(key));
    const otherLoad = vi.fn<Loader>((key) => Promise.resolve(key));
    const cache = plainCache(load);
    const other = plainCache(otherLoad, "lineage");

    await cache.get("a");
    await other.get("a");
    clearAllSharedCaches();
    await cache.get("a");
    await other.get("a");
    expect(load).toHaveBeenCalledTimes(2);
    expect(otherLoad).toHaveBeenCalledTimes(2);
  });

  it("drops a load that settles after its cache was cleared", async () => {
    const pending = deferred<string>();
    const load = vi
      .fn<Loader>()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce("after-clear");
    const cache = plainCache(load);

    const before = cache.get("a");
    cache.clear();
    pending.resolve("before-clear");
    await expect(before).resolves.toBe("before-clear");
    await expect(cache.get("a")).resolves.toBe("after-clear");
  });
});

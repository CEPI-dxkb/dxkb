import "server-only";

import { noop } from "@/lib/utils";

/**
 * A process-wide stale-while-revalidate cache with a per-cache circuit breaker,
 * for anonymous, public upstream data only. A loader must not send a session
 * token, read the request (`cookies()`, `headers()`, `readSession()`, …) or
 * take a request `AbortSignal`: it runs in whichever request started it and
 * its result is shared with every other request.
 */

export interface SharedCacheBreakerOptions {
  /**
   * Which load failures say the host is down; must be narrower than
   * `cacheError`. `elapsedMs` runs from the load's start to its failure.
   */
  trips: (error: unknown, elapsedMs: number) => boolean;
  failureThreshold?: number;
  windowMs?: number;
  openMs?: number;
}

export interface SharedCacheOptions<K extends string | number, V> {
  /** Unique per cache; caches created with the same name share their state. */
  name: string;
  load: (key: K, previous: V | undefined) => Promise<V>;
  freshMs: number | ((value: V) => number);
  /** How long a cached failure is served, and the wait after a failed refresh. */
  retryMs: number;
  /** 500 by default; evicts least recently used first, never a key whose load is running. */
  maxEntries?: number;
  /**
   * Which thrown errors may be cached; none when omitted. The cache does not
   * log a cacheable failure, even from a background refresh, beyond quoting the
   * one that opens or reopens the breaker, so the loader logs any it wants seen.
   */
  cacheError?: (error: unknown) => boolean;
  /**
   * Which cacheable errors are a definitive answer (a 404) that replaces a value
   * a failed background refresh would otherwise keep; consulted only when
   * `cacheError` holds.
   */
  replacesValue?: (error: unknown) => boolean;
  breaker?: SharedCacheBreakerOptions;
}

export interface SharedCache<K extends string | number, V> {
  get(key: K): Promise<V>;
  clear(): void;
}

type Settled = { ok: true; value: unknown } | { ok: false; error: unknown };

interface Entry {
  settled?: Settled;
  freshUntil: number;
  loading?: Promise<unknown>;
}

interface BreakerState {
  tripTimes: number[];
  open?: { until: number; error: unknown; probing: boolean };
}

interface CacheState {
  entries: Map<string | number, Entry>;
  breaker: BreakerState;
}

const defaultMaxEntries = 500;
const defaultFailureThreshold = 2;
const defaultWindowMs = 60_000;
const defaultOpenMs = 30_000;

// Route handlers and pages load separate module caches in a production build,
// so the state lives on `globalThis`; bump the version when its shape changes.
const sharedCacheStateKey = Symbol.for("dxkb.sharedCache.v1");

const registryHolder = globalThis as typeof globalThis & {
  [sharedCacheStateKey]?: Map<string, CacheState>;
};

const registry = (registryHolder[sharedCacheStateKey] ??= new Map<
  string,
  CacheState
>());

function stateFor(name: string): CacheState {
  let state = registry.get(name);
  if (!state) {
    state = { entries: new Map(), breaker: { tripTimes: [] } };
    registry.set(name, state);
  }
  return state;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function seconds(ms: number): string {
  return String(Math.round(ms / 100) / 10);
}

export function createSharedCache<K extends string | number, V>(
  options: SharedCacheOptions<K, V>,
): SharedCache<K, V> {
  const { name, load, retryMs, cacheError, replacesValue, breaker } = options;
  const maxEntries = options.maxEntries ?? defaultMaxEntries;
  const failureThreshold = breaker?.failureThreshold ?? defaultFailureThreshold;
  const windowMs = breaker?.windowMs ?? defaultWindowMs;
  const openMs = breaker?.openMs ?? defaultOpenMs;

  /** Throws for a non-finite window (NaN, Infinity), which would keep an entry fresh forever. */
  function freshFor(value: V): number {
    const ms =
      typeof options.freshMs === "function"
        ? options.freshMs(value)
        : options.freshMs;
    if (!Number.isFinite(ms)) {
      throw new RangeError(
        `shared-cache ${name}: freshMs is ${String(ms)}, not a finite number`,
      );
    }
    return ms;
  }

  /** A predicate that throws counts as `false`, and its error is logged. */
  function holds(
    predicate: ((error: unknown) => boolean) | undefined,
    error: unknown,
    label: string,
  ): boolean {
    if (!predicate) return false;
    try {
      return predicate(error);
    } catch (thrown) {
      console.error(`shared-cache ${name}: ${label} threw`, thrown);
      return false;
    }
  }

  /**
   * `probe` marks the one load let through while the breaker is half-open. A
   * cache without `breaker` could never settle a probe, so it ignores the open
   * breaker of a same-named cache.
   */
  function admit(
    state: CacheState,
    now: number,
  ): { blocked: false; probe: boolean } | { blocked: true; error: unknown } {
    const open = breaker ? state.breaker.open : undefined;
    if (!open) return { blocked: false, probe: false };
    if (now < open.until || open.probing) {
      return { blocked: true, error: open.error };
    }
    open.probing = true;
    return { blocked: false, probe: true };
  }

  function settleBreaker(
    state: CacheState,
    key: K,
    probe: boolean,
    failure?: { error: unknown; elapsedMs: number },
  ): void {
    if (!breaker || registry.get(name) !== state) return;
    const now = Date.now();
    const trip =
      failure &&
      holds(
        (error) => breaker.trips(error, failure.elapsedMs),
        failure.error,
        "breaker.trips",
      )
        ? failure
        : undefined;
    const status = state.breaker;
    if (probe && status.open) {
      if (trip) {
        status.open = { until: now + openMs, error: trip.error, probing: false };
        console.error(
          `shared-cache ${name}: upstream still down, retrying in ${seconds(openMs)} s: ${errorText(trip.error)}`,
          { key },
        );
        return;
      }
      status.open = undefined;
      status.tripTimes = [];
      console.info(`shared-cache ${name}: upstream marked back up`);
      return;
    }
    if (!trip) {
      status.tripTimes = [];
      return;
    }
    if (status.open) return;
    status.tripTimes = status.tripTimes.filter((at) => now - at < windowMs);
    status.tripTimes.push(now);
    if (status.tripTimes.length < failureThreshold) return;
    status.tripTimes = [];
    status.open = { until: now + openMs, error: trip.error, probing: false };
    console.error(
      `shared-cache ${name}: upstream marked down for ${seconds(openMs)} s: ${errorText(trip.error)}`,
      { key },
    );
  }

  function run(
    state: CacheState,
    key: K,
    entry: Entry,
    probe: boolean,
    background: boolean,
  ): Promise<V> {
    const previous = entry.settled?.ok ? (entry.settled.value as V) : undefined;

    function fail(error: unknown, mayCache: boolean): never {
      const cacheable = mayCache && holds(cacheError, error, "cacheError");
      // A cacheable failure (an outage, a 404) is the loader's to log.
      if (background && !cacheable) {
        console.error(`shared-cache ${name}: refresh of ${String(key)} failed`, error);
      }
      const keepsValue =
        entry.settled?.ok === true &&
        !(cacheable && holds(replacesValue, error, "replacesValue"));
      if (keepsValue) {
        entry.freshUntil = Date.now() + retryMs;
      } else if (cacheable) {
        entry.settled = { ok: false, error };
        entry.freshUntil = Date.now() + retryMs;
      } else if (state.entries.get(key) === entry) {
        state.entries.delete(key);
      }
      trim(state);
      throw error;
    }

    const startedAt = Date.now();
    // The executor turns a loader's synchronous throw into a rejection. Each
    // handler clears `loading` and settles the breaker before it calls any
    // other option, so a throwing `freshMs` cannot leave the key loading.
    const loading = new Promise<V>((resolve) => {
      resolve(load(key, previous));
    }).then(
      (value) => {
        entry.loading = undefined;
        settleBreaker(state, key, probe);
        let freshMs: number;
        try {
          freshMs = freshFor(value);
        } catch (error) {
          fail(error, false);
        }
        entry.settled = { ok: true, value };
        entry.freshUntil = Date.now() + freshMs;
        trim(state);
        return value;
      },
      (error: unknown) => {
        entry.loading = undefined;
        settleBreaker(state, key, probe, {
          error,
          elapsedMs: Date.now() - startedAt,
        });
        fail(error, true);
      },
    );
    entry.loading = loading;
    return loading;
  }

  /**
   * Evicts the least recently used idle entries beyond `maxEntries`. A loading
   * entry stays, so its key's callers keep sharing the load, and the map may
   * exceed the bound until a load settles and trims it again.
   */
  function trim(state: CacheState): void {
    if (registry.get(name) !== state) return;
    for (const [key, entry] of state.entries) {
      if (state.entries.size <= maxEntries) return;
      if (!entry.loading) state.entries.delete(key);
    }
  }

  async function get(key: K): Promise<V> {
    if (process.env.E2E_MOCK_ENABLED === "1") return load(key, undefined);

    const state = stateFor(name);
    const now = Date.now();
    const entry = state.entries.get(key);
    if (entry) {
      state.entries.delete(key);
      state.entries.set(key, entry);
      if (entry.settled) {
        if (!entry.loading && now >= entry.freshUntil) {
          const admission = admit(state, now);
          if (!admission.blocked) {
            run(state, key, entry, admission.probe, true).catch(noop);
          }
        }
        if (entry.settled.ok) return entry.settled.value as V;
        throw entry.settled.error;
      }
      if (entry.loading) return entry.loading as Promise<V>;
    }

    const admission = admit(state, now);
    if (admission.blocked) throw admission.error;
    const fresh: Entry = { freshUntil: 0 };
    state.entries.set(key, fresh);
    const loading = run(state, key, fresh, admission.probe, false);
    trim(state);
    return loading;
  }

  return {
    get,
    clear() {
      registry.delete(name);
    },
  };
}

/** Resets every cache and breaker; `vitest.setup.ts` calls it after each test. */
export function clearAllSharedCaches(): void {
  registry.clear();
}

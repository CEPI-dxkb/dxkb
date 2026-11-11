/**
 * A least-recently-used cache bounded by total weight (entry count by default), with an optional TTL.
 * Map iteration order is insertion order, so re-inserting on read keeps the oldest entry first.
 */
export interface BoundedCacheOptions<V> {
  maxWeight: number;
  weigh?: (value: V) => number;
  ttlMs?: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  weight: number;
  expiresAt: number;
}

export class BoundedCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private totalWeight = 0;

  constructor(private readonly options: BoundedCacheOptions<V>) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.delete(key);
    const weight = this.options.weigh?.(value) ?? 1;
    if (weight > this.options.maxWeight) return;
    this.entries.set(key, {
      value,
      weight,
      expiresAt: this.now() + (this.options.ttlMs ?? Number.POSITIVE_INFINITY),
    });
    this.totalWeight += weight;
    if (this.totalWeight <= this.options.maxWeight) return;
    // A read does not extend the TTL, so an expired entry can sit behind live ones; drop every expired entry before evicting by recency.
    this.deleteExpired();
    for (const oldest of this.entries.keys()) {
      if (this.totalWeight <= this.options.maxWeight) break;
      this.delete(oldest);
    }
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalWeight -= entry.weight;
  }

  /** Deletes `key` only while it still holds `value`, so a failure landing after a `clear()` and a newer request leaves the newer entry in place. */
  deleteIfCurrent(key: string, value: V): void {
    if (this.entries.get(key)?.value === value) this.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.totalWeight = 0;
  }

  private deleteExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.delete(key);
    }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

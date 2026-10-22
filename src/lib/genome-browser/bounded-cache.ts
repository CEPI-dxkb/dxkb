/**
 * A least-recently-used cache bounded by total weight (entry count by
 * default), with an optional time to live. Map iteration order is insertion
 * order, so re-inserting on read keeps the oldest entry first.
 *
 * Used server-side for whole contig sequences (weighed by length) and
 * browser-side for feature and sequence chunks.
 */
export interface BoundedCacheOptions<V> {
  maxWeight: number;
  weigh?: (value: V) => number;
  ttlMs?: number;
  /** Test seam for the clock. */
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

  clear(): void {
    this.entries.clear();
    this.totalWeight = 0;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

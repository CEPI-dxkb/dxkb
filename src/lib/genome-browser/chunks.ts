import type { BoundedCache } from "./bounded-cache";

export interface ChunkSpan {
  first: number;
  last: number;
}

export function chunkIndexes(
  start: number,
  end: number,
  chunkSize: number,
): number[] {
  if (end <= start) return [];
  const first = Math.floor(start / chunkSize);
  const last = Math.floor((end - 1) / chunkSize);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function coalesceChunks(
  indexes: readonly number[],
  maxChunks: number,
): ChunkSpan[] {
  const spans: ChunkSpan[] = [];
  for (const index of indexes) {
    const current = spans.at(-1);
    if (
      current &&
      index === current.last + 1 &&
      index - current.first + 1 <= maxChunks
    ) {
      current.last = index;
    } else {
      spans.push({ first: index, last: index });
    }
  }
  return spans;
}

export interface LoadChunksOptions<Result, Chunk> {
  cache: BoundedCache<Promise<Chunk>>;
  key: string;
  chunkSize: number;
  maxChunksPerRequest: number;
  start: number;
  end: number;
  fetchSpan: (start: number, end: number) => Promise<Result>;
  sliceChunk: (result: Result, chunkStart: number, chunkEnd: number) => Chunk;
}

/** A failed request is evicted so the next read retries it, and the route's own error reaches every waiting reader unchanged. */
export async function loadChunks<Result, Chunk>(
  options: LoadChunksOptions<Result, Chunk>,
): Promise<Chunk[]> {
  const { cache, key, chunkSize } = options;
  const chunkKey = (index: number) => `${key}|${String(index)}`;
  const indexes = chunkIndexes(options.start, options.end, chunkSize);
  const pending = new Map<number, Promise<Chunk>>();
  for (const index of indexes) {
    const cached = cache.get(chunkKey(index));
    if (cached) pending.set(index, cached);
  }
  const missing = indexes.filter((index) => !pending.has(index));
  for (const span of coalesceChunks(missing, options.maxChunksPerRequest)) {
    const request = options.fetchSpan(
      span.first * chunkSize,
      (span.last + 1) * chunkSize,
    );
    for (let index = span.first; index <= span.last; index += 1) {
      const chunkStart = index * chunkSize;
      const chunk = request.then((result) =>
        options.sliceChunk(result, chunkStart, chunkStart + chunkSize),
      );
      const cacheKey = chunkKey(index);
      void chunk.catch(() => {
        cache.deleteIfCurrent(cacheKey, chunk);
      });
      cache.set(cacheKey, chunk);
      pending.set(index, chunk);
    }
  }
  return Promise.all(
    indexes.map((index) => pending.get(index) ?? Promise.reject(
      new Error(`Genome Browser chunk ${String(index)} was never requested.`),
    )),
  );
}

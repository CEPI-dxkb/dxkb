import { BoundedCache } from "../bounded-cache";
import { chunkIndexes, coalesceChunks, loadChunks } from "../chunks";

describe("chunkIndexes", () => {
  it("lists the chunks a half-open range touches", () => {
    expect(chunkIndexes(0, 100, 100)).toEqual([0]);
    expect(chunkIndexes(99, 101, 100)).toEqual([0, 1]);
    expect(chunkIndexes(250, 400, 100)).toEqual([2, 3]);
  });

  it("is empty for an empty range", () => {
    expect(chunkIndexes(5, 5, 100)).toEqual([]);
  });
});

describe("coalesceChunks", () => {
  it("merges consecutive chunks up to the request limit", () => {
    expect(coalesceChunks([0, 1, 2, 4, 5], 2)).toEqual([
      { first: 0, last: 1 },
      { first: 2, last: 2 },
      { first: 4, last: 5 },
    ]);
  });
});

function sliceLoader() {
  const fetchSpan = vi.fn((start: number, end: number) =>
    Promise.resolve({ start, end }),
  );
  return {
    fetchSpan,
    options: (start: number, end: number) => ({
      cache: new BoundedCache<Promise<string>>({ maxWeight: 100 }),
      key: "genome|ctg",
      chunkSize: 10,
      maxChunksPerRequest: 3,
      start,
      end,
      fetchSpan,
      sliceChunk: (
        _result: { start: number; end: number },
        chunkStart: number,
        chunkEnd: number,
      ) => `${String(chunkStart)}-${String(chunkEnd)}`,
    }),
  };
}

describe("loadChunks", () => {
  it("fetches adjacent missing chunks in one request", async () => {
    const { fetchSpan, options } = sliceLoader();
    await expect(loadChunks(options(5, 25))).resolves.toEqual([
      "0-10",
      "10-20",
      "20-30",
    ]);
    expect(fetchSpan).toHaveBeenCalledTimes(1);
    expect(fetchSpan).toHaveBeenCalledWith(0, 30);
  });

  it("splits a wide range at the request limit", async () => {
    const { fetchSpan, options } = sliceLoader();
    await loadChunks(options(0, 50));
    expect(fetchSpan.mock.calls).toEqual([
      [0, 30],
      [30, 50],
    ]);
  });

  it("serves cached chunks without fetching", async () => {
    const { fetchSpan, options } = sliceLoader();
    const first = options(0, 20);
    await loadChunks(first);
    await loadChunks({ ...first, start: 5, end: 15 });
    expect(fetchSpan).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed chunk so the next read retries it", async () => {
    const { options } = sliceLoader();
    const failing = vi
      .fn()
      .mockRejectedValueOnce(new Error("Could not reach the data service"))
      .mockResolvedValue({ start: 0, end: 10 });
    const request = { ...options(0, 10), fetchSpan: failing };
    await expect(loadChunks(request)).rejects.toThrow(
      "Could not reach the data service",
    );
    await expect(loadChunks(request)).resolves.toEqual(["0-10"]);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("keeps the newer chunk when a request from before a clear fails", async () => {
    const { options } = sliceLoader();
    const stale = Promise.withResolvers<{ start: number; end: number }>();
    const fetchSpan = vi
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValue({ start: 0, end: 10 });
    const request = { ...options(0, 10), fetchSpan };
    const staleRead = loadChunks(request);
    request.cache.clear(); // an account change, while the first read is in flight
    await expect(loadChunks(request)).resolves.toEqual(["0-10"]);
    stale.reject(new Error("Could not reach the data service"));
    await expect(staleRead).rejects.toThrow("Could not reach the data service");
    await expect(loadChunks(request)).resolves.toEqual(["0-10"]);
    expect(fetchSpan).toHaveBeenCalledTimes(2);
  });
});

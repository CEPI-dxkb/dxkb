import { BoundedCache } from "../bounded-cache";

describe("BoundedCache", () => {
  it("deletes an entry only while it still holds the given value", () => {
    const cache = new BoundedCache<string>({ maxWeight: 2 });
    cache.set("a", "old");
    cache.set("a", "new");
    cache.deleteIfCurrent("a", "old");
    expect(cache.get("a")).toBe("new");
    cache.deleteIfCurrent("a", "new");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entries past its weight", () => {
    const cache = new BoundedCache<string>({ maxWeight: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1"); // a is now the most recent
    cache.set("c", "3");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
  });

  it("weighs values", () => {
    const cache = new BoundedCache<string>({
      maxWeight: 10,
      weigh: (value) => value.length,
    });
    cache.set("a", "123456");
    cache.set("b", "12345");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("12345");
  });

  it("never stores a value heavier than the whole cache", () => {
    const cache = new BoundedCache<string>({
      maxWeight: 3,
      weigh: (value) => value.length,
    });
    cache.set("a", "1234");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("expires entries after their time to live", () => {
    let now = 0;
    const cache = new BoundedCache<string>({
      maxWeight: 5,
      ttlMs: 100,
      now: () => now,
    });
    cache.set("a", "1");
    now = 99;
    expect(cache.get("a")).toBe("1");
    now = 100;
    expect(cache.get("a")).toBeUndefined();
  });

  it("drops expired entries before evicting a live one", () => {
    let now = 0;
    const cache = new BoundedCache<string>({
      maxWeight: 2,
      ttlMs: 100,
      now: () => now,
    });
    cache.set("a", "1"); // expires at 100
    now = 50;
    cache.set("b", "2"); // expires at 150
    now = 90;
    expect(cache.get("a")).toBe("1"); // a is now the most recent, b the oldest
    now = 120; // a has expired, b has not
    cache.set("c", "3");
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
    expect(cache.size).toBe(2);
  });

  it("replaces a key without double-counting its weight", () => {
    const cache = new BoundedCache<string>({ maxWeight: 1 });
    cache.set("a", "1");
    cache.set("a", "2");
    expect(cache.get("a")).toBe("2");
    expect(cache.size).toBe(1);
  });

  it("clears", () => {
    const cache = new BoundedCache<string>({ maxWeight: 2 });
    cache.set("a", "1");
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

// @vitest-environment node
import { readStorageItem, writeStorageItem } from "../browser-storage";

/**
 * Node 25+ defines its own `localStorage` global, and with `--localstorage-file`
 * it is one on-disk store shared by every request the server handles. A server
 * read must still see "nothing stored".
 */
function populatedStorage({ refuseWrites = false } = {}): Storage {
  const items = new Map([["k", "stored on the server"]]);
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      if (refuseWrites) throw new DOMException("quota", "QuotaExceededError");
      items.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser storage without a window", () => {
  it("reads nothing from a populated native store", () => {
    vi.stubGlobal("localStorage", populatedStorage());
    expect(typeof window).toBe("undefined");
    expect(readStorageItem("k")).toBeNull();
  });

  it("reads nothing from the in-memory fallback", () => {
    vi.stubGlobal("localStorage", populatedStorage({ refuseWrites: true }));
    writeStorageItem("unsaved", "kept in memory");
    expect(readStorageItem("unsaved")).toBeNull();
  });
});

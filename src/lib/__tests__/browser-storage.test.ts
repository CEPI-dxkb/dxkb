import { jsdomLocalStorage } from "@/test-helpers/storage";
import {
  readStorageItem,
  subscribeToStorage,
  writeStorageItem,
} from "../browser-storage";

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

describe("browser storage", () => {
  it("reads and writes, and removes on null", () => {
    writeStorageItem("k", "v");
    expect(readStorageItem("k")).toBe("v");
    writeStorageItem("k", null);
    expect(readStorageItem("k")).toBeNull();
  });

  it("notifies in-tab subscribers on write, and other-tab storage events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    writeStorageItem("k", "v");
    window.dispatchEvent(new StorageEvent("storage", { key: "k" }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    writeStorageItem("k", "w");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("never throws when storage is unusable", () => {
    vi.stubGlobal("localStorage", unusableStorage());
    expect(readStorageItem("k")).toBeNull();
    expect(() => {
      writeStorageItem("k", "v");
    }).not.toThrow();
  });
});

// The in-memory fallback is module state, so these tests load a fresh copy of the
// module each time (vi.resetModules + dynamic import) rather than share one whose
// unsaved values would leak from test to test.
describe("browser storage when storage refuses writes", () => {
  async function freshBrowserStorage() {
    vi.resetModules();
    return import("../browser-storage");
  }

  it("keeps the write for this tab and still notifies", async () => {
    const { readStorageItem, subscribeToStorage, writeStorageItem } =
      await freshBrowserStorage();
    vi.stubGlobal("localStorage", unusableStorage());
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);

    writeStorageItem("k", "v");
    expect(readStorageItem("k")).toBe("v");
    expect(listener).toHaveBeenCalledTimes(1);

    writeStorageItem("k", "w");
    expect(readStorageItem("k")).toBe("w");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("reads a removal as empty even though storage still holds the old value", async () => {
    const { readStorageItem, writeStorageItem } = await freshBrowserStorage();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "k" ? "stale" : null),
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });

    writeStorageItem("k", null);
    expect(readStorageItem("k")).toBeNull();
  });

  it("drops the in-memory copy once a write to that key goes through", async () => {
    const { readStorageItem, writeStorageItem } = await freshBrowserStorage();
    vi.stubGlobal("localStorage", unusableStorage());
    writeStorageItem("k", "unsaved");

    vi.stubGlobal("localStorage", jsdomLocalStorage());
    writeStorageItem("k", "saved");
    expect(localStorage.getItem("k")).toBe("saved");

    localStorage.removeItem("k");
    expect(readStorageItem("k")).toBeNull();
  });
});

function unusableStorage() {
  return {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
}

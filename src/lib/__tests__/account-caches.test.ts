import { clearAccountCaches, registerAccountCacheClear } from "../account-caches";

describe("account caches", () => {
  it("clears every registered cache on an account change", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerAccountCacheClear(first);
    registerAccountCacheClear(second);

    clearAccountCaches();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("clears a cache registered twice (a re-evaluated module) once", () => {
    const clear = vi.fn();
    registerAccountCacheClear(clear);
    registerAccountCacheClear(clear);

    clearAccountCaches();

    expect(clear).toHaveBeenCalledOnce();
  });
});

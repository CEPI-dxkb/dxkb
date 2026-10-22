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

  it("clears a cache whose clear function is registered twice only once", () => {
    const clear = vi.fn();
    registerAccountCacheClear(clear);
    registerAccountCacheClear(clear);

    clearAccountCaches();

    expect(clear).toHaveBeenCalledOnce();
  });
});

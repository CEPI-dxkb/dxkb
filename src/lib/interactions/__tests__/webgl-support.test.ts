import { afterEach, describe, expect, it, vi } from "vitest";

describe("supportsWebGl2", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("is true when a webgl2 context can be created, and releases it", async () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      getExtension,
    } as never);
    const { supportsWebGl2 } = await import("../webgl-support");
    expect(supportsWebGl2()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });

  it("is false when the context is null", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { supportsWebGl2 } = await import("../webgl-support");
    expect(supportsWebGl2()).toBe(false);
  });

  it("is false when context creation throws", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => {
        throw new Error("blocked");
      },
    );
    const { supportsWebGl2 } = await import("../webgl-support");
    expect(supportsWebGl2()).toBe(false);
  });
});

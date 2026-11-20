import { afterEach, describe, expect, it, vi } from "vitest";

describe("supportsWebGl2", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("is true when a webgl2 context can be created, and releases it", async () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const probed: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        probed.push(this);
        return { getExtension } as never;
      },
    );
    const { supportsWebGl2 } = await import("../webgl-support");
    expect(supportsWebGl2()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
    expect(probed).toHaveLength(1);
    expect(probed[0]?.width).toBe(0);
    expect(probed[0]?.height).toBe(0);
  });

  it("still frees the probe canvas when the browser has no WEBGL_lose_context", async () => {
    const probed: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        probed.push(this);
        return { getExtension: () => null } as never;
      },
    );
    const { supportsWebGl2 } = await import("../webgl-support");
    expect(supportsWebGl2()).toBe(true);
    expect(probed).toHaveLength(1);
    expect(probed[0]?.width).toBe(0);
    expect(probed[0]?.height).toBe(0);
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
